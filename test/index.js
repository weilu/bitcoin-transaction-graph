var assert = require('assert')
var sinon = require('sinon')
var Transaction = require('bitcoinjs-lib').Transaction
var testnet = require('bitcoinjs-lib').networks.testnet
var TxGraph = require('../index')
var fixtures = require('./fixtures')

function fakeTxHash(i) {
  var hash = new Buffer(32)
  hash.fill(i)
  return hash
}

function fakeTxId(i) {
  var hash = fakeTxHash(i)
  Array.prototype.reverse.call(hash)
  return hash.toString('hex')
}

function fakeTx(i) {
  var tx = new Transaction()
  sinon.stub(tx, "getId").returns(fakeTxId(i))
  return tx
}

function getTxIds(txs) {
  return txs.map(function(tx){ return tx.getId()})
}

function assertNodeIdsEqualTxIds(nodes, txids) {
  assert.deepEqual(nodes.map(function(n){ return n.id }).sort(), txids.sort())
}

function assertTxIdsSame(txs1, txs2) {
  assert.deepEqual(getTxIds(txs1).sort(), getTxIds(txs2).sort())
}

describe('TxGraph', function() {
  var txs = []
  var graph = new TxGraph()

  beforeEach(function() {
    for(var i=0; i<7; i++) {
      txs[i] = fakeTx(i)
    }
    txs[0].addInput(fakeTxId(7), 0)
    txs[1].addInput(fakeTxId(8), 0)
    txs[2].addInput(txs[0].getId(), 0)
    txs[2].addInput(txs[1].getId(), 1)
    txs[3].addInput(txs[1].getId(), 0)
    txs[4].addInput(txs[2].getId(), 0)
    txs[4].addInput(txs[3].getId(), 1)
    txs[6].addInput(txs[5].getId(), 0)

    graph.addTx(txs[6])
    graph.addTx(txs[5])
    graph.addTx(txs[0])
    graph.addTx(txs[2])
    graph.addTx(txs[4])
    graph.addTx(txs[3])
    graph.addTx(txs[1])
  })

  describe('addTx', function() {
    it('constructs the graph as expected', function() {
      assertNodeIdsEqualTxIds(graph.heads, [fakeTxId(6), fakeTxId(4)])
      assertNodeIdsEqualTxIds(graph.heads[0].prevNodes, [fakeTxId(5)])
      assertNodeIdsEqualTxIds(graph.heads[1].prevNodes, [fakeTxId(2), fakeTxId(3)])
      assertNodeIdsEqualTxIds(graph.heads[1].prevNodes[0].prevNodes, [fakeTxId(0), fakeTxId(1)])
      assertNodeIdsEqualTxIds(graph.heads[1].prevNodes[1].prevNodes, [fakeTxId(1)])
    })
  })

  describe('getInOrderTxs', function() {
    it('returns transactions in dependency order', function() {
      var orderedTxs = graph.getInOrderTxs()
      assertTxIdsSame(orderedTxs[0], [txs[0], txs[1]])
      assertTxIdsSame(orderedTxs[1], [txs[2], txs[3], txs[5]])
      assertTxIdsSame(orderedTxs[2], [txs[4], txs[6]])
    })
  })

  describe('findNodeById', function() {
    it('returns the tx', function() {
      var id = fakeTxId(5)
      assert.equal(graph.findNodeById(id).id, id)
    })
  })

  describe('getTails', function() {
    it('returns nodes that everybody else depends on', function() {
      var tails = graph.getTails()
      assertNodeIdsEqualTxIds(graph.getTails(), [fakeTxId(7), fakeTxId(8), fakeTxId(5)])
    })
  })

  describe('fees and amounts for regular pubkeyhash type of transaction', function() {
    var txs = {}

    var graph = new TxGraph()
    var tx = fixtures.pubkeyhash
    var txObj = Transaction.fromHex(tx.hex)
    graph.addTx(txObj)
    txs[tx.txid] = tx

    tx.ins.forEach(function(input) {
      graph.addTx(Transaction.fromHex(input.prevTx.hex))
      txs[input.prevTx.txid] = input.prevTx

      input.prevTx.ins.forEach(function(input) {
        graph.addTx(Transaction.fromHex(input.prevTx.hex))
        txs[input.prevTx.txid] = input.prevTx
      })
    })

    describe('calculateFees', function() {
      it('attaches expected fees to transactions', function() {
        graph.calculateFees()
        graph.getInOrderTxs().forEach(function(group) {
          group.forEach(function(t) {
            assert.equal(t.fee, txs[t.getId()].fee)
          })
        })
      })
    })

    describe('calculateFeesAndValues', function() {
      it('attaches expected fees to transactions', function() {
        graph.getInOrderTxs().forEach(function(group) {
          graph.calculateFeesAndValues()
          group.forEach(function(t) {
            assert.equal(t.fee, txs[t.getId()].fee)
          })
        })
      })

      describe('values', function() {
        it('my address is one of the inputs', function() {
          var input = tx.ins[0]
          graph.calculateFeesAndValues(input.address, testnet)
          assert.equal(graph.findNodeById(tx.txid).tx.value, input.value)
          assert.equal(graph.findNodeById(input.prevTx.txid).tx.value, input.prevTx.ins[0].prevTx.value)
        })

        it('all inputs are my addresses', function() {
          graph.calculateFeesAndValues(tx.ins.map(function(input) {
            return input.address
          }), testnet)

          assert.equal(graph.findNodeById(tx.txid).tx.value, tx.ins.reduce(function(memo, input) {
            return input.value + memo
          }, 0))
          tx.ins.forEach(function(input) {
            assert.equal(graph.findNodeById(input.prevTx.txid).tx.value, input.prevTx.ins[0].prevTx.value)
          })
        })

        it('my address is the first input and the first output', function() {
          var input = tx.ins[0]
          var output = tx.outs[0]

          graph.calculateFeesAndValues([ input.address, output.address ], testnet)

          assert.equal(graph.findNodeById(tx.txid).tx.value, input.value + output.value)
          assert.equal(graph.findNodeById(input.prevTx.txid).tx.value, input.prevTx.ins[0].prevTx.value)
        })

        it('all inputs are my addresses, plus the first output', function() {
          var output = tx.outs[0]
          var addresses = tx.ins.map(function(input) {
            return input.address
          }).concat(output.address)

          graph.calculateFeesAndValues(addresses, testnet)

          var expectedValue = tx.ins.reduce(function(memo, input) {
            return input.value + memo
          }, 0) + output.value
          assert.equal(graph.findNodeById(tx.txid).tx.value, expectedValue)

          tx.ins.forEach(function(input) {
            assert.equal(graph.findNodeById(input.prevTx.txid).tx.value, input.prevTx.ins[0].prevTx.value)
          })
        })
      })

    })

  })
})
