var assert = require('assert')
var Node = require('../node')

describe('Node', function() {
  describe('constructor', function() {
    it('inits id, tx, prevNodes and nextNodes', function() {
      var node = new Node('foo', 'bar', ['foo'], ['bar'])
      assert.equal(node.id, 'foo')
      assert.equal(node.tx, 'bar')
      assert.deepEqual(node.prevNodes, ['foo'])
      assert.deepEqual(node.nextNodes, ['bar'])
    })

    it('defaults prevNodes and nextNodes to empty arrays', function() {
      var node = new Node()
      assert.deepEqual(node.prevNodes, [])
      assert.deepEqual(node.nextNodes, [])
    })
  })

  describe('addToNextNodes', function() {
    var node1, node2

    beforeEach(function() {
      node1 = new Node(1)
      node2 = new Node(2)
    })

    it('works and takes care of prevNodes relationship', function() {
      node1.addToNextNodes(node2)
      assert(node1.nextNodes.indexOf(node2) >= 0)
      assert(node2.prevNodes.indexOf(node1) >= 0)
    })

    it('does not double add', function() {
      node1.addToNextNodes(node2)
      var nextNodesLength = node1.nextNodes.length
      var prevNodesLength = node2.prevNodes.length

      node1.addToNextNodes(node2)

      assert.equal(node1.nextNodes.length, nextNodesLength)
      assert.equal(node2.prevNodes.length, prevNodesLength)
    })
  })

  describe('removeFromNextNodes', function() {
    var node1, node2

    beforeEach(function() {
      node1 = new Node(1)
      node2 = new Node(2)
    })

    it('works and takes care of prevNodes relationship', function() {
      node1.addToNextNodes(node2)
      node1.removeFromNextNodes(node2)
      assert(node1.nextNodes.indexOf(node2) < 0)
      assert(node2.prevNodes.indexOf(node1) < 0)
    })

    it('does not error when the target node does not exist in nextNodes', function() {
      assert.doesNotThrow(function() {
        node1.removeFromNextNodes(node2)
      })
    })
  })
})
