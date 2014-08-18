function TxGraph() {
  this.heads = []
}

TxGraph.prototype.addTx = function(tx) {
  var node = findNodeById(tx.getId(), this.heads) || new Node(tx.getId())
  if(node.nextNodes.length === 0) {
    this.heads.push(node)
  }
  node.tx = tx

  node.prevNodes = tx.ins.map(function(txIn) {
    var txinId = new Buffer(txIn.hash)
    Array.prototype.reverse.call(txinId)
    txinId = txinId.toString('hex')

    return findNodeById(txinId, this.heads) || new Node(txinId)
  }, this)

  node.prevNodes.forEach(function(n) {
    var i = this.heads.indexOf(n)
    if(i >= 0) this.heads.splice(i, 1)

    n.nextNodes.push(node)
  }, this)
}

TxGraph.prototype.getInOrderTxs = function() {
  return bft(this.heads).reverse().map(function(group){
    var txs = group.reduce(function(memo, n) {
      if(n.tx) memo[n.tx.getId()] = n.tx
      return memo
    }, {})

    return values(txs)
  })
}

function values(obj) {
  var results = []
  for(var k in obj) {
    results.push(obj[k])
  }
  return results
}

function bft(nodes) {
  if(!nodes || nodes.length === 0) return []

  var children = []
  nodes.forEach(function(n) {
    children = children.concat(n.prevNodes)
  })

  return [nodes].concat(bft(children))
}

function findNodeById(txid, nodes) {
  if(!nodes || nodes.length === 0) return

  var result
  nodes.some(function(node) {
    var found = node.id === txid
    if(found) { result = node }
    return found
  })

  if(result) return result

  var children = []
  nodes.forEach(function(n) {
    children = children.concat(n.prevNodes)
  })

  return findNodeById(txid, children)
}

function Node(id, tx, prevNodes, nextNodes) {
  this.id = id
  this.tx = tx
  this.prevNodes = prevNodes || []
  this.nextNodes = nextNodes || []
}

module.exports = TxGraph
