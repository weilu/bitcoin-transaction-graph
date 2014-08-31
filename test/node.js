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
})
