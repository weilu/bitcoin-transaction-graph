var assert = require('assert')
var sinon = require('sinon')
var Transaction = require('bitcoinjs-lib').Transaction
var TxGraph = require('../index')

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

function assertNodeIdsEqualTxIds(nodes, txs) {
  assert.deepEqual(nodes.map(function(n){ return n.id }).sort(), getTxIds(txs).sort())
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
      assertNodeIdsEqualTxIds(graph.heads, [txs[6], txs[4]])
      assertNodeIdsEqualTxIds(graph.heads[0].prevNodes, [txs[5]])
      assertNodeIdsEqualTxIds(graph.heads[1].prevNodes, [txs[2], txs[3]])
      assertNodeIdsEqualTxIds(graph.heads[1].prevNodes[0].prevNodes, [txs[0], txs[1]])
      assertNodeIdsEqualTxIds(graph.heads[1].prevNodes[1].prevNodes, [txs[1]])
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

  describe('findTxById', function() {
    it('returns the tx', function() {
      var id = fakeTxId(5)
      var tx = graph.findTxById(id)
      assert.equal(tx.getId(), id)
    })
  })
})
