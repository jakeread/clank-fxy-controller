/*
gridsquid.js

osap tool drawing set

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

'use strict'

import dt from './domtools.js'
import * as dat from '../libs/dat.gui.module.js'
import { TS, PK, DK, AK, EP } from '../../core/ts.js'

export default function GRIDSQUID(osap, xPlace, yPlace) {
  // ------------------------------------------------------ PLANE / ZOOM / PAN
  let plane = $('<div>').addClass('plane').get(0)
  let wrapper = $('#wrapper').get(0)
  // odd, but w/o this, scaling the plane & the background together introduces some numerical errs,
  // probably because the DOM is scaling a zero-size plane, or somesuch.
  $(plane).css('background', 'url("/client/drawing/bg.png")').css('width', '100px').css('height', '100px')
  let cs = 1 // current scale,
  let dft = { s: cs, x: 0, y: 0, ox: 0, oy: 0 } // default transform

  // zoom on wheel
  wrapper.addEventListener('wheel', (evt) => {
    if($(evt.target).is('input, textarea')) return 
    evt.preventDefault()
    evt.stopPropagation()

    let ox = evt.clientX
    let oy = evt.clientY

    let ds
    if (evt.deltaY > 0) {
      ds = 0.025
    } else {
      ds = -0.025
    }

    let ct = dt.readTransform(plane)
    ct.s *= 1 + ds
    ct.x += (ct.x - ox) * ds
    ct.y += (ct.y - oy) * ds

    // max zoom pls thx
    if (ct.s > 1.5) ct.s = 1.5
    if (ct.s < 0.05) ct.s = 0.05
    cs = ct.s
    dt.writeTransform(plane, ct)
    dt.writeBackgroundTransform(wrapper, ct)
  })

  // pan on drag,
  wrapper.addEventListener('mousedown', (evt) => {
    if($(evt.target).is('input, textarea')) return 
    evt.preventDefault()
    evt.stopPropagation()
    dt.dragTool((drag) => {
      drag.preventDefault()
      drag.stopPropagation()
      let ct = dt.readTransform(plane)
      ct.x += drag.movementX
      ct.y += drag.movementY
      dt.writeTransform(plane, ct)
      dt.writeBackgroundTransform(wrapper, ct)
    })
  })

  // init w/ defaults,
  dt.writeTransform(plane, dft)
  dt.writeBackgroundTransform(wrapper, dft)

  $(wrapper).append(plane)

  // ------------------------------------------------------ RENDER / RERENDER
  // all nodes render into the plane, for now into the wrapper
  // once ready to render, heights etc should be set,
  let renderNode = (node) => {
    let nel = $(`<div>`).addClass('node').get(0) // node class is position:absolute
    nel.style.width = `${parseInt(node.width)}px`
    nel.style.height = `${parseInt(node.height)}px`
    nel.style.left = `${parseInt(node.pos.x)}px`
    nel.style.top = `${parseInt(node.pos.y)}px`
    $(nel).append($(`<div>${node.name}</div>`).addClass('nodename'))
    if (node.el) $(node.el).remove()
    node.el = nel
    $(plane).append(node.el)
  }

  let renderVPort = (vPort, outgoing) => {
    let nel = $('<div>').addClass('vPort').get(0)
    nel.style.width = `${parseInt(vPort.parent.width) - 4}px`
    let ph = perPortHeight - heightPadding
    nel.style.height = `${parseInt(ph)}px`
    nel.style.left = `${parseInt(vPort.parent.pos.x)}px`
    let ptop = vPort.parent.pos.y + heightPadding + vPort.indice * perPortHeight + heightPadding / 2
    nel.style.top = `${parseInt(ptop)}px`
    $(nel).append($(`<div>${vPort.name}</div>`).addClass('vPortname'))
    // draw outgoing svg,
    if(outgoing){
      // anchor position (absolute, within attached-to), delx, dely
      let line = dt.svgLine(perNodeWidth - 2, ph / 2, linkWidth, 0, 2)
      $(nel).append(line) // appended, so that can be rm'd w/ the .remove() call
    }
    if (vPort.el) $(vPort.el).remove()
    vPort.el = nel
    $(plane).append(vPort.el)
  }

  // draw vals,
  let perNodeWidth = 60
  let linkWidth = 30
  let perPortHeight = 120
  let heightPadding = 10

  // for now, this'll look a lot like thar recursor,
  // and we'll just do it once, assuming nice and easy trees ...
  this.draw = (root) => {
    let start = performance.now()
    $('.node').remove()
    $('.vPort').remove()
    // alright binches lets recurse,
    // node-to-draw, vPort-entered-on, depth of recursion
    let recursor = (node, entry, entryTop, depth) => {
      node.width = perNodeWidth // time being, we are all this wide
      node.height = heightPadding * 2 + node.vPorts.length * perPortHeight // 10px top / bottom, 50 per port
      node.pos = {}
      node.pos.x = depth * (perNodeWidth + linkWidth) + xPlace // our x-pos is related to our depth,
      // and the 'top' - now, if entry has an .el / etc data - if ports have this data as well, less calc. here
      if (entry) {
        node.pos.y = entryTop - entry.indice * perPortHeight - heightPadding
      } else {
        node.pos.y = yPlace
      }
      // draw ready?
      renderNode(node)
      // traverse,
      for (let vp of node.vPorts) {
        if (vp == entry) {
          renderVPort(vp)
          continue
        } else if (vp.reciprocal) {
          renderVPort(vp, true)
          recursor(vp.reciprocal.parent, vp.reciprocal, node.pos.y + heightPadding + vp.indice * perPortHeight, depth + 1)
        } else {
          renderVPort(vp)
        }
      }
    }
    recursor(root, null, 0, 0)
    //console.warn('draw was', performance.now() - start)
    // root.pos = {
    //   x: 10,
    //   y: 10
    // }
    // root.width = 100
    // root.height = 100
    // renderNode(root)
    // console.warn('next call')
    // root.pos.x = 50
    // renderNode(root)
  } // end draw 

  // ------------------------------------------------------ SWEEP ROUTINES

  // node is an element in the tree,
  // path is the route to it, in uint8array
  let sweepRecurse = async (node) => {
    for (let p in node.vPorts) {
      // don't try closed ports,
      if (node.vPorts[p].portStatus != EP.PORTSTATUS.OPEN) continue
      // can't traverse busses yet,
      if (node.vPorts[p].portTypeKey != PK.PORTF.KEY) {
        console.error('cannot traverse busses yet')
        continue // BUSDIFFERENCE
      }
      // don't want to traverse back up,
      // at this point, only the layer above has ahn reciprocal established, we are traversing down
      if (node.vPorts[p].reciprocal) continue
      // ok, we're set to dive,
      let nextRoute = {
        path: new Uint8Array(node.routeTo.path.length + 3),
        segsize: 128
      }
      nextRoute.path.set(node.routeTo.path)
      nextRoute.path[node.routeTo.path.length] = PK.PORTF.KEY
      TS.write('uint16', parseInt(p), nextRoute.path, node.routeTo.path.length + 1, true)
      //console.log('next path', nextRoute)
      try {
        // get num vPorts at next node, and use route back to discover exit port
        let nodeRes = await osap.query(nextRoute, 'name', 'numVPorts')
        //console.warn('noderes route', nodeRes.route)
        // if this works, a node exists on the other side of this port,
        let nextNode = {
          routeTo: nextRoute,
          name: nodeRes.data.name,
          vPorts: []
        }
        // the port that the above query entered on,
        let entryPort = TS.read('uint16', nodeRes.route.path, 1, true)
        // for each next in line,
        for (let np = 0; np < nodeRes.data.numVPorts; np++) {
          try {
            let portRes = await osap.query(nextRoute, 'vport', np, 'name', 'portTypeKey', 'portStatus', 'maxSegLength')
            if(portRes.data.portStatus == EP.PORTSTATUS.CLOSED){
              // try open, 
              try {
                // console.warn('req open')
                let writeRes = await osap.write(nextRoute, 'vport', np, 'portStatus', true)
              } catch (err) {
                console.warn('write-open err', err)
              }
            }
            //console.log("PORT", portRes.data)
            let vPort = {
              parent: nextNode,
              indice: parseInt(np),
              name: portRes.data.name,
              portTypeKey: portRes.data.portTypeKey,
              portStatus: portRes.data.portStatus,
              maxSegLength: portRes.data.maxSegLength,
            }
            nextNode.vPorts.push(vPort)
            if(np == entryPort){
              // circular linking
              node.vPorts[p].reciprocal = nextNode.vPorts[np] // p (node-port) np (next-node-port)
              nextNode.vPorts[np].reciprocal = node.vPorts[p]
            }
          } catch (err) {
            console.error(err)
            console.error('sweep / draw error at port', p, ',', nextNode.name)
            nextNode.vPorts.push(null)
          }
        } // close query on next ports,
        // continue
        await sweepRecurse(nextNode)
      } catch (err) {
        throw err // ?? doth this pass up the layer ?
      }
    }
  }

  let sweeper = async () => {
    // start from nil,
    let root = {} // home node,
    root.vPorts = [] // our ports,
    root.name = osap.name
    root.routeTo = {
      path: new Uint8Array(0),
      segsize: 128
    }
    // make definitions of our local ports,
    for (let p in osap.vPorts) {
      let pOut = {
        indice: parseInt(p),
        portTypeKey: osap.vPorts[p].portTypeKey,
        portStatus: osap.vPorts[p].phy.status,
        maxSegLength: osap.vPorts[p].phy.maxSegLength,
        name: osap.vPorts[p].name
      }
      root.vPorts.push(pOut)
      pOut.parent = root
      // kick closed ports: this is different then the remainder of recurse, because we have 
      // direct access to it, 
      if(pOut.portStatus == EP.PORTSTATUS.CLOSED){
        osap.vPorts[p].phy.open()
      }
    }
    // now we can start here, to recurse through
    try {
      await sweepRecurse(root)
    } catch (err) {
      console.error('err during sweep', err)
    }
    // return the structure
    return root
  }

  // hmm ...
  let depthAnalysis = (root) => {
    let depths = [0]
    let recursor = (vPort, depth) => {
      if (depth > 6) return // depth limit
      if (vPort.reciprocal) { // places to go,
        for (let vp of vPort.reciprocal.parent.vPorts) {
          depths.push(depth + 1)
          console.log(vPort.reciprocal.parent.name)
          if (vp == vPort.reciprocal) continue // skip entry // TODO circular graphs would stil f us here
          recursor(vp, depth + 1)
        }
      }
    } // end recursor,
    for (let vp of root.vPorts) {
      recursor(vp, 0)
    }
    return Math.max(...depths)
  }

  // ------------------------------------------------------ DAT Control

  let ctrl = {
    polling: true,
    interval: 600,
    timer: undefined
  }
  
  let setPollingStatus = (val) =>{
    if(val){
      runSweepRoutine()
    } else {
      if(ctrl.timer){
        clearTimeout(ctrl.timer)
        ctrl.timer = undefined
      }
    }
  }
  
  let runSweepRoutine = async () => {
    try {
      let res = await sweeper()
      this.draw(res)
    } catch (err) {
      console.error('sweeper err', err)
    }
    if(ctrl.polling){
      ctrl.timer = setTimeout(runSweepRoutine, ctrl.interval)
    }
  }
  
  let gui = new dat.GUI({autoPlace: false})
  
  // place dat, 
  $(gui.domElement).css("position", "absolute")
  dt.writeTransform(gui.domElement, { s: cs, x: xPlace + 500, y: yPlace, ox: 0, oy: 0 })
  $(plane).append(gui.domElement)
  
  
  let pollControl = gui.add(ctrl, 'polling').onChange(setPollingStatus)
  
  gui.add(ctrl, 'interval')

  // ------------------------------------------------------ START CONDITION 

  if(ctrl.polling) runSweepRoutine()
}
