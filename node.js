function Node(id, tx, prevNodes, nextNodes) {
  this.id = id
  this.tx = tx
  this.prevNodes = prevNodes || []
  this.nextNodes = nextNodes || []
}

Node.prototype.addToNextNodes = function(toAdd)  {
  if(this.nextNodes.indexOf(toAdd) >= 0) {
    console.warn(this.id, 'already contain', toAdd.id, "in nextNodes")
  } else {
    this.nextNodes.push(toAdd)
    if(toAdd.prevNodes.indexOf(this) >= 0) {
      console.warn(toAdd.id, 'already contain', this.id, "in prevNodes")
    } else {
      toAdd.prevNodes.push(this)
    }
  }
}

Node.prototype.removeFromNextNodes = function(toRemove) {
  var index = this.nextNodes.indexOf(toRemove)
  if(index >= 0) {
    this.nextNodes.splice(index, 1)

    var prevNodeIndex = toRemove.prevNodes.indexOf(this)
    if(prevNodeIndex >= 0) {
      toRemove.prevNodes.splice(prevNodeIndex, 1)
    } else {
      console.warn(toRemove.id, 'does not contain', this.id, "in prevNodes")
    }
  } else {
    console.warn(this.id, 'does not contain', toRemove.id, "in nextNodes")
  }
}


module.exports = Node
