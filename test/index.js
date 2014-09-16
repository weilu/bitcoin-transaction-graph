var assert = require('assert')
var Transaction = require('bitcoinjs-lib').Transaction
var testnet = require('bitcoinjs-lib').networks.testnet
var TxGraph = require('../index')
var fixtures = require('./fixtures')
var buildTxs = require('./helper').buildTxs
var fakeTxId = require('./helper').fakeTxId

function assertNodeIdsEqualTxIds(nodes, txids) {
  assert.deepEqual(nodes.map(function(n){ return n.id }), txids)
}

function assertNodeIdsEqualTxIdsIgnoreOrder(nodes, txids) {
  assert.deepEqual(nodes.map(function(n){ return n.id }).sort(), txids.sort())
}

describe('TxGraph', function() {
  var txs = []
  var graph = new TxGraph()

  beforeEach(function() {
    txs = buildTxs()
  })

  describe('addTx', function() {
    it('constructs the graph as expected', function() {
      txs.forEach(function(tx) { graph.addTx(tx) })

      assertNodeIdsEqualTxIds(graph.heads, [fakeTxId(0), fakeTxId(3), fakeTxId(4), fakeTxId(15), fakeTxId(16)])
      assertNodeIdsEqualTxIdsIgnoreOrder(graph.heads[0].prevNodes, [fakeTxId(13)])
      assertNodeIdsEqualTxIdsIgnoreOrder(graph.heads[1].prevNodes, [fakeTxId(2), fakeTxId(5), fakeTxId(7)])
      assertNodeIdsEqualTxIdsIgnoreOrder(graph.heads[1].prevNodes[0].prevNodes, [fakeTxId(1), fakeTxId(10)])
      assertNodeIdsEqualTxIdsIgnoreOrder(graph.heads[1].prevNodes[1].prevNodes, [fakeTxId(6)])
      assertNodeIdsEqualTxIdsIgnoreOrder(graph.heads[1].prevNodes[2].prevNodes, [fakeTxId(6)])
    })

    it('orders the nextNodes according to output indexes', function() {
      txs.forEach(function(tx) { graph.addTx(tx) })

      var tx14node = graph.heads[3].prevNodes[0]
      assertNodeIdsEqualTxIds(tx14node.nextNodes, [fakeTxId(15), fakeTxId(16)])

      var tx2node = tx14node.prevNodes[0]
      assertNodeIdsEqualTxIds(tx2node.nextNodes, [fakeTxId(14), fakeTxId(3)])

      var tx7node = graph.heads[2].prevNodes[0]
      assertNodeIdsEqualTxIds(tx7node.nextNodes, [fakeTxId(3), fakeTxId(4)])

      var tx6node = tx7node.prevNodes[0]
      assertNodeIdsEqualTxIds(tx6node.nextNodes, [fakeTxId(5), fakeTxId(7)])

      var tx10node = tx2node.prevNodes[1]
      assertNodeIdsEqualTxIds(tx10node.nextNodes, [fakeTxId(2), fakeTxId(8), fakeTxId(9)])
    })

    it('does not double add head', function() {
      txs.forEach(function(tx) { graph.addTx(tx) })
      graph.addTx(txs[0])

      assertNodeIdsEqualTxIds(graph.heads, [fakeTxId(0), fakeTxId(3), fakeTxId(4), fakeTxId(15), fakeTxId(16)])
    })
  })

  describe('getAllNodes', function() {
    it('returns all the nodes in the graph', function() {
      txs.forEach(function(tx) { graph.addTx(tx) })

      var allNodes = graph.getAllNodes()
      assert.equal(allNodes.length, txs.length)
      assertNodeIdsEqualTxIdsIgnoreOrder(allNodes, txs.map(function(tx) {
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

  describe('compareNodes', function() {
    it('returns -1 when a is a direct dependency of b', function() {
      txs.forEach(function(tx) { graph.addTx(tx) })
      assert.equal(graph.compareNodes(getNode(2), getNode(3)), -1)
    })

    it('returns -1 when a is a indirect dependency of b', function() {
      txs.forEach(function(tx) { graph.addTx(tx) })
      assert.equal(graph.compareNodes(getNode(6), getNode(4)), -1)
    })

    it('returns 1 when b is a direct dependency of a', function() {
      txs.forEach(function(tx) { graph.addTx(tx) })
      assert.equal(graph.compareNodes(getNode(3), getNode(2)), 1)
    })

    it('returns 1 when b is a indirect dependency of a', function() {
      txs.forEach(function(tx) { graph.addTx(tx) })
      assert.equal(graph.compareNodes(getNode(4), getNode(6)), 1)
    })

    it('returns 0 when a and b does not depend on each other', function() {
      txs.forEach(function(tx) { graph.addTx(tx) })
      assert.equal(graph.compareNodes(getNode(3), getNode(4)), 0)
      assert.equal(graph.compareNodes(getNode(0), getNode(2)), 0)
    })

    function getNode(i) {
      return graph.findNodeById(fakeTxId(i))
    }
  })

  describe('getTails', function() {
    it('returns nodes that everybody else depends on', function() {
      txs.forEach(function(tx) { graph.addTx(tx) })

      var tails = graph.getTails()
      assertNodeIdsEqualTxIdsIgnoreOrder(graph.getTails(), [fakeTxId(1), fakeTxId(11), fakeTxId(12), fakeTxId(13)])
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

    describe('calculateFee', function() {
      it('returns the expected fee of a transaction', function() {
        assert.equal(graph.calculateFee(txObj), 10000)
      })

      it('is able to calculate fee for a tx that is not in the graph', function() {
        var t = new Transaction()
        t.addInput(txObj, 0)
        t.addOutput('mzutX1jQomSy7vPBuxCq1UaHFHJxPmNC6E', 600000)
        assert.equal(graph.calculateFee(t), 400000)
      })
    })

    describe('calculateFees', function() {
      it('returns a hash of tx ids to fees', function() {
        var fees = graph.calculateFees()
        graph.getAllNodes().forEach(function(n) {
          if(n.tx == null) return;
          assert.equal(fees[n.id].fee, txs[n.id].fee)
        })
      })
    })

    describe('calculateFeesAndValues', function() {
      it('returns the expected fees', function() {
        var feesAndValues = graph.calculateFeesAndValues()
        graph.getAllNodes().forEach(function(n) {
          if(n.tx == null) return;
          assert.equal(feesAndValues[n.id].fee, txs[n.id].fee)
        })
      })

      describe('values', function() {
        it('my address is one of the inputs', function() {
          var input = tx.ins[0]
          var feesAndValues = graph.calculateFeesAndValues(input.address, testnet)
          assert.equal(feesAndValues[tx.txid].value, input.value)
          assert.equal(feesAndValues[input.prevTx.txid].value, input.prevTx.ins[0].prevTx.value)
        })

        it('all inputs are my addresses', function() {
          var feesAndValues = graph.calculateFeesAndValues(tx.ins.map(function(input) {
            return input.address
          }), testnet)

          assert.equal(feesAndValues[tx.txid].value, tx.ins.reduce(function(memo, input) {
            return input.value + memo
          }, 0))
          tx.ins.forEach(function(input) {
            assert.equal(feesAndValues[input.prevTx.txid].value, input.prevTx.ins[0].prevTx.value)
          })
        })

        it('my address is the first input and the first output', function() {
          var input = tx.ins[0]
          var output = tx.outs[0]

          var feesAndValues = graph.calculateFeesAndValues([ input.address, output.address ], testnet)

          assert.equal(feesAndValues[tx.txid].value, input.value + output.value)
          assert.equal(feesAndValues[input.prevTx.txid].value, input.prevTx.ins[0].prevTx.value)
        })

        it('all inputs are my addresses, plus the first output', function() {
          var output = tx.outs[0]
          var addresses = tx.ins.map(function(input) {
            return input.address
          }).concat(output.address)

          var feesAndValues = graph.calculateFeesAndValues(addresses, testnet)

          var expectedValue = tx.ins.reduce(function(memo, input) {
            return input.value + memo
          }, 0) + output.value
          assert.equal(feesAndValues[tx.txid].value, expectedValue)

          tx.ins.forEach(function(input) {
            assert.equal(feesAndValues[input.prevTx.txid].value, input.prevTx.ins[0].prevTx.value)
          })
        })
      })

    })

  })
})
