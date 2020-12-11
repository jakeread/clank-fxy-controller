/*
osapc.js

osap tool client side

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

'use strict'

import OSAP from '../core/osap.js'
import { Input, Output } from '../core/modules.js'
import GRIDSQUID from './drawing/gridsquid.js'
import VirtualMachine from './virtualMachine.js'

import { TS, PK, DK, AK, EP } from '../core/ts.js'

import { GCodePanel, Button, TextInput, JogBox } from './gCodePanel.js'
import Pad from './pad.js'

console.log("hello-osap-tools")

// an instance of some osap capable thing (the virtual object)
// that will appear on the network, be virtually addressable
let osap = new OSAP()
osap.name = "client"
osap.description = "browser OSAP interface"

// draws network config, draws plane, etc 
// position args are for where-to-draw config tree 
let gs = new GRIDSQUID(osap, 10, 900)

// panel, 
let gCodePanel = new GCodePanel(10, 10)

// pipe moves 2 machine 
let moveInput = new Input()
gCodePanel.moveOut.attach(moveInput)
moveInput.addListener(async (move) => {
  return new Promise((resolve, reject) => {
    vm.addMoveToQueue(move).then(() => {
      resolve()
    }).catch((err) => {
      console.error(err)
      reject(err)
    })
  })
})

// connect awaitMotionEnd() to gcode parser 

let motionWaitIn = new Input()
gCodePanel.awaitMotionEnd.attach(motionWaitIn)
motionWaitIn.addListener(async () => {
  return new Promise((resolve, reject) => {
    vm.awaitMotionEnd().then(() => {
      resolve()
    }).catch((err) => {
      console.error(err)
      reject(err)
    })
  })
})

// pipe spindle 2 machine 
let spindleIn = new Input()
gCodePanel.spindleOut.attach(spindleIn)
spindleIn.addListener(async (rpm) => {
  return new Promise((resolve, reject) => {
    vm.setRPM(rpm).then(() => {
      setTimeout(resolve, 500)
    }).catch((err) => {
      console.error(err)
      reject(err)
    })
  })
})

let vm = new VirtualMachine(osap)

// -------------------------------------------------------- HOME, JOG, ZERO

// pardon the mess, these are redefined for the jog box... 
// could properly wrap all btn action up over there, sometime! 

let BTN_RED = 'rgb(242, 201, 201)'
let BTN_GRN = 'rgb(201, 242, 201)'
let BTN_YLW = 'rgb(240, 240, 180)'
let BTN_GREY = 'rgb(242, 242, 242)'
let BTN_HANGTIME = 1000
let BTN_ERRTIME = 2000

// go home 
let homeBtn = Button(240, 10, 54, 14, 'home')
$(homeBtn).on('click', (evt) => {
  vm.home().then(() => {
    $(homeBtn).text('ok')
    setTimeout(() => {
      $(homeBtn).text('home')
    }, 500)
  }).catch((err) => {
    console.error(err)
    $(homeBtn).text('err!')
    setTimeout(() => {
      $(homeBtn).text('home')
    }, 500)
  })
  $(homeBtn).text('homing...')
})

// query queue length 
let qqlBtn = Button(310, 10, 54, 14, 'queue ?')
$(qqlBtn).on('click', (evt) => {
  if (qqlBtn.clicked) return
  qqlBtn.clicked = true
  vm.queryQueueLength().then((len) => {
    $(qqlBtn).text(`${len}`).css('background-color', BTN_GRN)
    setTimeout(() => { $(qqlBtn).text(`queue ?`).css('background-color', BTN_GREY); qqlBtn.clicked = false }, BTN_HANGTIME)
  }).catch((err) => {
    console.error(err)
    $(qqlBtn).text('error').css('background-color', BTN_RED)
    setTimeout(() => { $(qqlBtn).text(`queue ?`).css('background-color', BTN_GREY); qqlBtn.clicked = false }, BTN_ERRTIME)
  })
  $(qqlBtn).text('...').css('background-color', BTN_YLW)
})

// query motion status 
let mqBtn = Button(380, 10, 54, 14, 'moving ?')
$(mqBtn).on('click', (evt) => {
  if (mqBtn.clicked) return
  mqBtn.clicked = true
  vm.queryMotionStatus().then((state) => {
    $(mqBtn).text(`${state}`).css('background-color', BTN_GRN)
    setTimeout(() => { $(mqBtn).text(`moving ?`).css('background-color', BTN_GREY); mqBtn.clicked = false }, BTN_HANGTIME)
  }).catch((err) => {
    console.error(err)
    $(mqBtn).text('error').css('background-color', BTN_RED)
    setTimeout(() => { $(mqBtn).text(`moving ?`).css('background-color', BTN_GREY); mqBtn.clicked = false }, BTN_ERRTIME)
  })
  $(mqBtn).text('...').css('background-color', BTN_YLW)
})

// query position 
let pqBtn = Button(450, 10, 204, 14, 'pos ?')
$(pqBtn).on('click', (evt) => {
  if (pqBtn.clicked) return
  pqBtn.clicked = true
  vm.queryPosition().then((pos) => {
    $(pqBtn).text(`${pos.X.toFixed(3)}, ${pos.Y.toFixed(3)}, ${pos.Z.toFixed(3)}`).css('background-color', BTN_GRN)
    setTimeout(() => { $(pqBtn).text(`pos ?`).css('background-color', BTN_GREY); pqBtn.clicked = false }, BTN_HANGTIME)
  }).catch((err) => {
    console.error(err)
    $(pqBtn).text('error').css('background-color', BTN_RED)
    setTimeout(() => { $(pqBtn).text(`pos ?`).css('background-color', BTN_GREY); pqBtn.clicked = false }, BTN_ERRTIME)
  })
  $(pqBtn).text('...').css('background-color', BTN_YLW)
})

let spInput = TextInput(450, 40, 210, 20, '0.000, 0.000, 0.000')
let lpBtn = Button(240, 40, 84, 14, 'get pos')
$(lpBtn).on('click', (ev) => {
  if(lpBtn.clicked) return 
  lpBtn.clicked = true 
  // git posn from machine 
  let pos = vm.queryPosition().then((pos) => {
    // write it to input value, to modify... 
    spInput.value = `${pos.X.toFixed(3)}, ${pos.Y.toFixed(3)}, ${pos.Z.toFixed(3)}`
    $(lpBtn).text(`ok ->`).css('background-color', BTN_GRN)
    setTimeout(() => { $(lpBtn).text(`get pos`).css('background-color', BTN_GREY); lpBtn.clicked = false }, BTN_HANGTIME)
  }).catch((err) => {
    console.error(err)
    $(lpBtn).text('error').css('background-color', BTN_RED)
    setTimeout(() => { $(lpBtn).text(`set pos`).css('background-color', BTN_GREY); lpBtn.clicked = false }, BTN_ERRTIME)
  })
  $(lpBtn).text('...').css('background-color', BTN_YLW)
})

let spBtn = Button(340, 40, 94, 14, 'set pos')
$(spBtn).on('click', (evt) => {
  if (spBtn.clicked) return
  spBtn.clicked = true
  // get from input, arr 
  let psns = spInput.value.split(',')
  let badParse = false
  for (let p in psns) {
    psns[p] = parseFloat(psns[p])
    if (Number.isNaN(psns[p])) {
      badParse = true
    }
  }
  if (psns.length != 3) badParse = true
  if (badParse) {
    $(spBtn).text('bad set-target parse')
    setTimeout(() => {
      $(spBtn).text(`set pos`).css('background-color', BTN_GREY)
      spBtn.clicked = false
    }, BTN_HANGTIME)
    return
  }
  vm.setPosition({ X: psns[0], Y: psns[1], Z: psns[2] }).then(() => {
    // this is ok, so 
    return vm.queryPosition()
  }).then((pos) => {
    $(spBtn).text(`ok ->`).css('background-color', BTN_GRN)
    setTimeout(() => { $(spBtn).text(`set pos`).css('background-color', BTN_GREY); spBtn.clicked = false }, BTN_HANGTIME)
  }).catch((err) => {
    console.error(err)
    $(spBtn).text('error').css('background-color', BTN_RED)
    setTimeout(() => { $(spBtn).text(`set pos`).css('background-color', BTN_GREY); spBtn.clicked = false }, BTN_ERRTIME)
  })
  $(spBtn).text('...').css('background-color', BTN_YLW)
})

// remote set currents 
let scBtn = Button(240, 70, 194, 14, 'set currents')
let scInput = TextInput(450, 70, 210, 20, '0.2, 0.2, 0.2')
$(scBtn).on('click', (evt) => {
  if (scBtn.clicked) return
  scBtn.clicked = true
  // get from input, arr 
  let currents = scInput.value.split(',')
  let badParse = false
  for (let p in currents) {
    currents[p] = parseFloat(currents[p])
    if (Number.isNaN(currents[p])) {
      badParse = true
    }
  }
  if (currents.length != 3) badParse = true
  if (badParse) {
    $(scBtn).text('bad set-target parse').css('background-color', BTN_RED)
    setTimeout(() => {
      $(scBtn).text(`set currents`).css('background-color', BTN_GREY)
      scBtn.clicked = false
    }, BTN_HANGTIME)
    return
  }
  vm.setCurrents({ X: currents[0], Y: currents[1], Z: currents[2] }).then(() => {
    $(scBtn).text(`ok`).css('background-color', BTN_GRN)
    setTimeout(() => { $(scBtn).text(`set currents`).css('background-color', BTN_GREY); scBtn.clicked = false }, BTN_HANGTIME)
  }).catch((err) => {
    console.error(err)
    $(scBtn).text('error').css('background-color', BTN_RED)
    setTimeout(() => { $(scBtn).text(`set currents`).css('background-color', BTN_GREY); scBtn.clicked = false }, BTN_ERRTIME)
  })
  $(scBtn).text('...').css('background-color', BTN_YLW)
})

// remote set tool 
let toolGripped = false 
let tgBtn = Button(240, 100, 194, 14, 'grip tool')
$(tgBtn).on('click', (evt) => {
  if(tgBtn.clicked) return 
  tgBtn.clicked = true 
  $(tgBtn).text('...').css('background-color', BTN_YLW)
  if(toolGripped){
    vm.releaseTool().then(() => {
      toolGripped = false
      $(tgBtn).text('grip tool').css('background-color', BTN_GREY); tgBtn.clicked = false
    }).catch((err) => {
      console.error(err)
      $(tgBtn).text('error').css('background-color', BTN_RED) 
    })
  } else {
    vm.gripTool().then(() => {
      toolGripped = true 
      $(tgBtn).text('release tool').css('background-color', BTN_GREY); tgBtn.clicked = false
    }).catch((err) => {
      console.error(err)
      $(tgBtn).text('error').css('background-color', BTN_RED) 
    })
  }  
})

let calBtn = Button(450, 100, 94, 14, 'calibr8')
$(calBtn).on('click', (evt) => {
  if(calBtn.clicked) return 
  calBtn.clicked = true 
  $(calBtn).text('...').css('background-color', BTN_YLW)
  vm.runCalibration().then(() => {
    $(calBtn).text('ok').css('background-color', BTN_GRN)
    setTimeout(() => { $(calBtn).text(`calibr8`).css('background-color', BTN_GREY); calBtn.clicked = false }, BTN_HANGTIME)
  }).catch((err) => {
    console.error(err)
    $(calBtn).text('err').css('background-color', BTN_RED)
    setTimeout(() => { $(calBtn).text(`calibr8`).css('background-color', BTN_GREY); calBtn.clicked = false }, BTN_ERRTIME)
  })
})

let unlockBtn = Button(560, 100, 94, 14, 'release')
$(unlockBtn).on('click', (evt) => {
  if(unlockBtn.clicked) return 
  unlockBtn.clicked = true 
  $(unlockBtn).text('...').css('background-color', BTN_YLW)
  vm.unlockTool().then(() => {
    $(unlockBtn).text('ok').css('background-color', BTN_GRN)
    setTimeout(() => { $(unlockBtn).text('release').css('background-color', BTN_GREY); unlockBtn.clicked = false }, BTN_HANGTIME)
  }).catch((err) => {
    console.error(err)
    $(unlockBtn).text('error').css('background-color', BTN_RED)
    setTimeout(() => { $(unlockBtn).text('release').css('background-color', BTN_GREY); unlockBtn.clicked = false }, BTN_ERRTIME)
  })
})

let pickupBtn = Button(240, 130, 84, 14, 'pickup')
$(pickupBtn).on('click', (evt) => {
  if(pickupBtn.clicked) return 
  pickupBtn.clicked = true 
  $(pickupBtn).text('...').css('background-color', BTN_YLW)
  vm.pickupTool(225, 2).then(() => {
    $(pickupBtn).text('ok').css('background-color', BTN_GRN)
    setTimeout(() => { $(pickupBtn).text('pickup').css('background-color', BTN_GREY); pickupBtn.clicked = false }, BTN_HANGTIME)
  }).catch((err) => {
    console.error(err)
    $(pickupBtn).text('error').css('background-color', BTN_RED)
    setTimeout(() => { $(pickupBtn).text('pickup').css('background-color', BTN_GREY); pickupBtn.clicked = false }, BTN_ERRTIME)
  })
})

let dropBtn = Button(340, 130, 94, 14, 'drop')
$(dropBtn).on('click', (evt) => {
  if(dropBtn.clicked) return 
  dropBtn.clicked = true 
  $(dropBtn).text('...').css('background-color', BTN_YLW)
  vm.dropTool(225, 2).then(() => {
    $(dropBtn).text('ok').css('background-color', BTN_GRN)
    setTimeout(() => { $(dropBtn).text('drop').css('background-color', BTN_GREY); dropBtn.clicked = false }, BTN_HANGTIME)
  }).catch((err) => {
    console.error(err)
    $(dropBtn).text('error').css('background-color', BTN_RED)
    setTimeout(() => { $(dropBtn).text('drop').css('background-color', BTN_GREY); dropBtn.clicked = false }, BTN_ERRTIME)
  })
})

let jogBox = new JogBox(670, 10, vm)

// render 
let pad = new Pad(240, 160, 610, 610)

// -------------------------------------------------------- STARTUP LOCAL

let wscVPort = osap.vPort()
wscVPort.name = 'websocket client'

// to test these systems, the client (us) will kickstart a new process
// on the server, and try to establish connection to it.
console.log("making client-to-server request to start remote process,")
console.log("and connecting to it w/ new websocket")
// ok, let's ask to kick a process on the server,
// in response, we'll get it's IP and Port,
// then we can start a websocket client to connect there,
// automated remote-proc. w/ vPort & wss medium,
// for args, do '/processName.js?args=arg1,arg2'
let LOGPHY = false
jQuery.get('/startLocal/osapl-usb-bridge.js', (res) => {
  if (res.includes('OSAP-wss-addr:')) {
    let addr = res.substring(res.indexOf(':') + 2)
    if (addr.includes('ws://')) {
      console.log('starting socket to remote at', addr)
      wscVPort.phy.status = EP.PORTSTATUS.OPENING
      let ws = new WebSocket(addr)
      wscVPort.phy.maxSegLength = 1024
      ws.onopen = (evt) => {
        wscVPort.setPortOpen()
        wscVPort.phy.send = (buffer) => {
          if (LOGPHY) console.log('PHY WSC Send', buffer)
          ws.send(buffer)
        }
        ws.onmessage = (msg) => {
          msg.data.arrayBuffer().then((buffer) => {
            let uint = new Uint8Array(buffer)
            if (LOGPHY) console.log('PHY WSC Recv')
            if (LOGPHY) TS.logPacket(uint)
            wscVPort.phy.receive(uint)
          }).catch((err) => {
            console.error(err)
          })
        }
      }
      ws.onerror = (err) => {
        wscVPort.phy.status = EP.PORTSTATUS.CLOSED
        console.log('sckt err', err)
      }
      ws.onclose = (evt) => {
        wscVPort.phy.status = EP.PORTSTATUS.CLOSED
        console.log('sckt closed', evt)
      }
    }
  } else {
    console.error('remote OSAP not established', res)
  }
})

// -------------------------------------------------------- KEYS 

let ctrlDown = false

document.addEventListener('keydown', (evt) => {
  if (evt.keyCode == 17) ctrlDown = true
  if (!ctrlDown) return
  console.log(`keycode ${evt.keyCode}`)
  switch (evt.keyCode) {
    case 9: // 'tab' - BREAKS the interface, catch and rm 
      evt.preventDefault()
      evt.stopPropagation()
      return
    case 69: // 'e'
      osap.ping(twoHop).then((res) => {
        console.warn('PING', res)
      }).catch((err) => {
        console.error(err)
      })
      break;
    case 81: // 'q'
      if (pQueryTimer) {
        clearTimeout(pQueryTimer)
      } else {
        positionQuery()
      }
      break;
    case 82: // 'r'
      osap.ping(twoHop).then((res) => {
        osap.query(twoHop, 'name', 'description', 'numVPorts').then((resp) => {
          console.warn(resp)
        }).catch((err) => {
          console.error(err)
        })
      }).catch((err) => {
        console.error(err)
      })
      break;
    case 80: // 'p'
      //pollControl.setValue(!ctrl.polling)
      break;
    case 83: // 's'
      // sweep... now bottled in GS 
      break;
  }
})

document.addEventListener('keyup', (evt) => {
  if (evt.keyCode == 17) ctrlDown = false
})
