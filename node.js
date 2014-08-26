function Node(id, tx, prevNodes, nextNodes) {
  this.id = id
  this.tx = tx
  this.prevNodes = prevNodes || []
  this.nextNodes = nextNodes || []
}

Node.prototype.addToNextNodes = function(toAdd)  {
  if(this.nextNodes.indexOf(toAdd) >= 0) return;

  this.nextNodes.push(toAdd)
  if(toAdd.prevNodes.indexOf(this) >= 0) {
    console.warn(toAdd.id, 'already contain', this.id, "in prevNodes")
  } else {
    toAdd.prevNodes.push(this)
  }
}

Node.prototype.removeFromNextNodes = function(toRemove) {
  var index = this.nextNodes.indexOf(toRemove)
  if(index < 0) return;

  this.nextNodes.splice(index, 1)

  var prevNodeIndex = toRemove.prevNodes.indexOf(this)
  if(prevNodeIndex >= 0) {
    toRemove.prevNodes.splice(prevNodeIndex, 1)
  } else {
    console.warn(toRemove.id, 'does not contain', this.id, "in prevNodes")
  }
}


module.exports = Node
