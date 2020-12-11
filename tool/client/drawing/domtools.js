/*
domtools.js

osap tool drawing utility

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

// -------------------------------------------------------- TRANSFORM

// move things,
let writeTransform = (div, tf) => {
  //console.log('vname, div, tf', view.name, div, tf)
  if (tf.s) {
    div.style.transform = `scale(${tf.s})`
  } else {
    div.style.transform = `scale(1)`
  }
  //div.style.transformOrigin = `${tf.ox}px ${tf.oy}px`
  div.style.left = `${parseInt(tf.x)}px`
  div.style.top = `${parseInt(tf.y)}px`
}

// a utility to do the same, for the background, for *the illusion of movement*,
// as a note: something is wrongo with this, background doth not zoom at the same rate...
let writeBackgroundTransform = (div, tf) => {
  div.style.backgroundSize = `${tf.s * 10}px ${tf.s * 10}px`
  div.style.backgroundPosition = `${tf.x + 50*(1-tf.s)}px ${tf.y + 50*(1-tf.s)}px`
}

// a uility to read those transforms out of elements,
// herein lays ancient mods code, probably a better implementation exists
let readTransform = (div) => {
  // transform, for scale
  let transform = div.style.transform
  let index = transform.indexOf('scale')
  let left = transform.indexOf('(', index)
  let right = transform.indexOf(')', index)
  let s = parseFloat(transform.slice(left + 1, right))

  // left and right, position
  let x = parseFloat(div.style.left)
  let y = parseFloat(div.style.top)

  return ({
    s: s,
    x: x,
    y: y
  })
}

// -------------------------------------------------------- DRAG Attach / Detach

let dragTool = (dragHandler, upHandler) => {
  let onUp = (evt) => {
    if (upHandler) upHandler(evt)
    window.removeEventListener('mousemove', dragHandler)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', dragHandler)
  window.addEventListener('mouseup', onUp)
}

// -------------------------------------------------------- SVG

// return in an absolute-positioned wrapper at ax, ay, with dx / dy endpoint
let svgLine = (ax, ay, dx, dy, width) => {
  let cont = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  $(cont).addClass('svgcont').css('left', ax).css('top', ay)
  let path = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  $(cont).append(path)
  path.style.stroke = '#1a1a1a'
  path.style.fill = 'none'
  path.style.strokeWidth = `${width}px`
  path.setAttribute('x1', 0)
  path.setAttribute('y1', 0)
  path.setAttribute('x2', dx)
  path.setAttribute('y2', dy)
  return cont
}

export default {
  writeTransform,
  writeBackgroundTransform,
  readTransform,
  dragTool,
  svgLine
}
