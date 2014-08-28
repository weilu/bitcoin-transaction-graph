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

describe('TxGraph', function() {
  var txs = []
  var graph = new TxGraph()

  beforeEach(function() {
    for(var i=0; i<17; i++) {
      txs[i] = fakeTx(i)
    }

    txs[0].addInput(fakeTxId(13), 0)

    txs[2].addInput(fakeTxId(1), 0)
    txs[2].addInput(fakeTxId(10), 1)

    txs[3].addInput(fakeTxId(2), 0)
    txs[3].addInput(fakeTxId(5), 1)
    txs[3].addInput(fakeTxId(7), 2)

    txs[4].addInput(fakeTxId(7), 0)

    txs[5].addInput(fakeTxId(6), 0)

    txs[6].addInput(fakeTxId(8), 0)
    txs[6].addInput(fakeTxId(9), 1)

    txs[7].addInput(fakeTxId(6), 0)

    txs[8].addInput(fakeTxId(10), 0)

    txs[9].addInput(fakeTxId(10), 0)
    txs[9].addInput(fakeTxId(12), 1)

    txs[10].addInput(fakeTxId(11), 0)

    txs[14].addInput(fakeTxId(2), 0)
    txs[15].addInput(fakeTxId(14), 0)
    txs[16].addInput(fakeTxId(14), 0)
  })

  describe('addTx', function() {
    it('constructs the graph as expected', function() {
      txs.forEach(function(tx) { graph.addTx(tx) })

      assertNodeIdsEqualTxIds(graph.heads, [fakeTxId(0), fakeTxId(3), fakeTxId(4), fakeTxId(15), fakeTxId(16)])
      assertNodeIdsEqualTxIds(graph.heads[0].prevNodes, [fakeTxId(13)])
      assertNodeIdsEqualTxIds(graph.heads[1].prevNodes, [fakeTxId(2), fakeTxId(5), fakeTxId(7)])
      assertNodeIdsEqualTxIds(graph.heads[1].prevNodes[0].prevNodes, [fakeTxId(1), fakeTxId(10)])
      assertNodeIdsEqualTxIds(graph.heads[1].prevNodes[1].prevNodes, [fakeTxId(6)])
    })
  })

  describe('getAllNodes', function() {
    it('returns all the nodes in the graph', function() {
      txs.forEach(function(tx) { graph.addTx(tx) })

      var allNodes = graph.getAllNodes()
      assert.equal(allNodes.length, txs.length)
      assertNodeIdsEqualTxIds(allNodes, txs.map(function(tx) {
        return tx.getId()
      }))
    })
  })

  describe('findNodeById', function() {
    it('returns the tx', function() {
      txs.forEach(function(tx) { graph.addTx(tx) })

      var id = fakeTxId(5)
      assert.equal(graph.findNodeById(id).id, id)
    })
  })

  describe('getTails', function() {
    it('returns nodes that everybody else depends on', function() {
      txs.forEach(function(tx) { graph.addTx(tx) })

      var tails = graph.getTails()
      assertNodeIdsEqualTxIds(graph.getTails(), [fakeTxId(1), fakeTxId(11), fakeTxId(12), fakeTxId(13)])
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
        graph.getAllNodes().forEach(function(n) {
          if(n.tx == null) return;
          assert.equal(n.tx.fee, txs[n.id].fee)
        })
      })
    })

    describe('calculateFeesAndValues', function() {
      it('attaches expected fees to transactions', function() {
        graph.calculateFeesAndValues()
        graph.getAllNodes().forEach(function(n) {
          if(n.tx == null) return;
          assert.equal(n.tx.fee, txs[n.id].fee)
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
