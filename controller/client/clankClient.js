/*
clank-client.js

clank controller client side

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

'use strict'

import OSAP from '../osapjs/core/osap.js'
import { TS, PK, DK, AK, EP } from '../osapjs/core/ts.js'
import NetRunner from '../osapjs/client/netrunner/osap-render.js'

// the clank 'virtual machine'
import ClankVM from './clankVirtualMachine.js'

// sort of stand-alone prototype input / output system for JS... it doth not network
import { Input, Output } from '../osapjs/core/modules.js'

import { GCodePanel } from '../osapjs/client/components/gCodePanel.js'
import { AutoPlot } from '../osapjs/client/components/autoPlot.js'
import { Button } from '../osapjs/client/interface/button.js'
import { TextInput } from '../osapjs/client/interface/textInput.js'
import { JogBox } from '../osapjs/client/components/jogBox.js'

console.log("hello clank controller")

// an instance of some osap capable thing (the virtual object)
// that will appear on the network, be virtually addressable
let osap = new OSAP()
osap.name = "clank client"
osap.description = "clank cz browser interface"

// draws network, 
let netrunner = new NetRunner(osap, 10, 760, false)

// -------------------------------------------------------- THE VM

// vm, 
let vm = new ClankVM(osap)

// -------------------------------------------------------- MOTION FEED

// panel, 
let gCodePanel = new GCodePanel(10, 10)

// pipe moves 2 machine 
window.eForward = 0
window.eRetract = 0
let moveInput = new Input()
gCodePanel.moveOut.attach(moveInput)
moveInput.addListener((move) => {
  return new Promise((resolve, reject) => {
    move.rate = move.rate // ?
    /*
    if(move.position.E > 0){
      window.eForward += move.position.E
    } else {
      window.eRetract += move.position.E
    }
    resolve()
    return
    */
    vm.addMoveToQueue(move).then(() => {
      resolve()
    }).catch((err) => { reject(err) })
  })
})

let jogBox = new JogBox(240, 10, vm)

// this is... kind of buggy. button state sometimes straightforwards, sometimes callback hell 
let posBtn = new Button(430, 10, 344, 14, 'pos')
let posLp = false
posBtn.onClick(() => {
  if (posLp) {
    posLp = false
    posBtn.good("stop", 500)
  } else {
    let poll = () => {
      if (!posLp) return
      vm.getPos().then((pos) => {
        if (posLp) {
          $(posBtn.elem).text(`X: ${pos.X.toFixed(2)}, Y: ${pos.Y.toFixed(2)}, Z: ${pos.Z.toFixed(2)}, E: ${pos.E.toFixed(2)}`)
          setTimeout(poll, 50)
        }
      }).catch((err) => {
        posLp = false
        console.error(err)
        posBtn.bad("err", 1000)
      })
    }
    posLp = true
    poll()
  }
})

let setStartBtn = new Button(360, 130, 94, 14, 'offset zero')
setStartBtn.onClick(() => {
  vm.setPos({
    X: 0,
    Y: 0,
    Z: 121.8,
    E: 0
  }).then(() => {
    setStartBtn.good("ok", 500)
  }).catch((err) => {
    console.error(err)
    setStartBtn.bad("err", 500)
  })
})

let gotoZeroBtn = new Button(360, 160, 94, 14, 'goto zero')
gotoZeroBtn.onClick(() => {
  vm.addMoveToQueue({
    rate: 600,
    position: {
      X: 0,
      Y: 0,
      Z: 0,
      E: 0,
    }
  }).then(() => {
    gotoZeroBtn.good("ok", 500)
  }).catch((err) => {
    console.error(err)
    gotoZeroBtn.bad("err", 500)
  })
})

// -------------------------------------------------------- TEMP CONTROLLER 

let tempController = (xPlace, yPlace, i, init) => {
  let tvm = vm.tvm[i]

  let tempSet = new TextInput(xPlace, yPlace, 110, 20, `${init}`)

  let tempSetBtn = new Button(xPlace, yPlace + 30, 104, 14, 'set temp')
  tempSetBtn.onClick(() => {
    let temp = parseFloat(tempSet.value)
    if (Number.isNaN(temp)) {
      tempSetBtn.bad("parse err", 1000)
      return
    }
    tvm.setExtruderTemp(temp).then(() => {
      tempSetBtn.good("ok", 500)
    }).catch((err) => {
      console.error(err)
      tempSetBtn.bad("err", 1000)
    })
  })

  let tempCoolBtn = new Button(xPlace, yPlace + 60, 104, 14, 'cooldown')
  tempCoolBtn.onClick(() => {
    tvm.setExtruderTemp(0).then(() => {
      tempCoolBtn.good("ok", 500)
    }).catch((err) => {
      console.error(err)
      tempCoolBtn.bad("err", 500)
    })
  })

  let tempPlot = new AutoPlot(xPlace + 120, yPlace, 420, 230)
  tempPlot.setHoldCount(500)
  //tempPlot.setYDomain(0, 100)
  tempPlot.redraw()

  let effortPlot = new AutoPlot(xPlace + 120, yPlace + 240, 420, 150)
  effortPlot.setHoldCount(500)
  //effortPlot.setYDomain(-10, 10)
  effortPlot.redraw()

  let tempLpBtn = new Button(xPlace, yPlace + 90, 104, 14, 'plot temp')
  let tempLp = false
  let tempLpCount = 0
  tempLpBtn.onClick(() => {
    if (tempLp) {
      tempLp = false
      tempLpBtn.good("stopped", 500)
    } else {
      let poll = () => {
        if (!tempLp) return
        tvm.getExtruderTemp().then((temp) => {
          //console.log(temp)
          tempLpCount++
          tempPlot.pushPt([tempLpCount, temp])
          tempPlot.redraw()
          return tvm.getExtruderTempOutput()
        }).then((effort) => {
          //console.log(effort)
          effortPlot.pushPt([tempLpCount, effort])
          effortPlot.redraw()
          setTimeout(poll, 200)
        }).catch((err) => {
          tempLp = false
          console.error(err)
          tempLpBtn.bad("err", 500)
        })
      }
      tempLp = true
      poll()
    }
  })

  let pVal = new TextInput(xPlace, yPlace + 120, 110, 20, '-0.1')
  let iVal = new TextInput(xPlace, yPlace + 150, 110, 20, '0.0')
  let dVal = new TextInput(xPlace, yPlace + 180, 110, 20, '0.1')

  let pidSetBtn = new Button(xPlace, yPlace + 210, 104, 14, 'set PID')
  pidSetBtn.onClick(() => {
    let p = parseFloat(pVal.value)
    let i = parseFloat(iVal.value)
    let d = parseFloat(dVal.value)
    if (Number.isNaN(p) || Number.isNaN(i) || Number.isNaN(d)) {
      pidSetBtn.bad("bad parse", 1000)
      return
    }
    tvm.setPIDTerms([p, i, d]).then(() => {
      pidSetBtn.good("ok", 500)
    }).catch((err) => {
      console.error(err)
      pidSetBtn.bad("err", 1000)
    })
  })
}

tempController(240, 190, 0, 220)
tempController(240, 590, 1, 60)

// -------------------------------------------------------- MOTION SETTINGS
// todo: should bundle with jog, position query, etc ? or get on with other work 

let setRatesBtn = new Button(790, 10, 84, 24, 'set acc & max fr')
let accText = new Button(790, 50, 84, 14, 'mm/sec^2')
let xAccVal = new TextInput(790, 80, 90, 20, '300')
let yAccVal = new TextInput(790, 110, 90, 20, '300')
let zAccVal = new TextInput(790, 140, 90, 20, '50')
let eAccVal = new TextInput(790, 170, 90, 20, '900')

let rateText = new Button(790, 200, 84, 14, 'mm/min')
let xRateVal = new TextInput(790, 230, 90, 20, '12000')
let yRateVal = new TextInput(790, 260, 90, 20, '12000')
let zRateVal = new TextInput(790, 290, 90, 20, '1000')
let eRateVal = new TextInput(790, 320, 90, 20, '60000')

let setupMotion = () => {
  // accel 
  let aVals = {
    X: parseFloat(xAccVal.value),
    Y: parseFloat(yAccVal.value),
    Z: parseFloat(zAccVal.value),
    E: parseFloat(eAccVal.value)
  }
  for (let v in aVals) {
    if (Number.isNaN(aVals[v])) { console.error('bad parse for float', v); return }
  }
  // rates
  let rVals = {
    X: parseFloat(xRateVal.value),
    Y: parseFloat(yRateVal.value),
    Z: parseFloat(zRateVal.value),
    E: parseFloat(eRateVal.value)
  }
  for (let v in rVals) {
    if (Number.isNaN(rVals[v])) { console.error('bad parse for float', r); return }
  }
  // network 
  return new Promise((resolve, reject) => {
    vm.setAccels(aVals).then(() => {
      return vm.setRates(rVals)
    }).then(() => {
      resolve()
    }).catch((err) => { reject(err) })
  })
}

setRatesBtn.onClick(() => {
  setupMotion().then(() => {
    setRatesBtn.good("ok", 500)
  }).catch((err) => {
    console.error(err)
    setRatesBtn.bad("err", 500)
  })
})

// -------------------------------------------------------- MOTOR SETTINGS

let setMotorsBtn = new Button(790, 360, 84, 14, 'motor setup')
setMotorsBtn.onClick(() => {
  vm.initMotors().then(() => {
    setMotorsBtn.good("ok", 500)
  }).catch((err) => {
    console.error(err)
    setMotorsBtn.bad("err", 500)
  })
})

let disableMotorsBtn = new Button(790, 390, 84, 14, 'disable')
disableMotorsBtn.onClick(() => {
  vm.disableMotors().then(() => {
    disableMotorsBtn('ok', 500)
  }).catch((err) => {
    console.error(err)
    disableMotorsBtn.bad("err", 500)
  })
})

let enableMotorsBtn = new Button(790, 420, 84, 14, 'enable')
enableMotorsBtn.onClick(() => {
  vm.enableMotors().then(() => {
    enableMotorsBtn('ok', 500)
  }).catch((err) => {
    console.error(err)
    enableMotorsBtn.bad("err", 500)
  })
})

// -------------------------------------------------------- MACHINE INIT

let initMachineBtn = new Button(470, 130, 84, 44, 'init vm')
initMachineBtn.onClick(() => {
  setupMotion().then(() => {
    return vm.initMotors()
  }).then(() => {
    initMachineBtn.good("ok", 500)
  }).catch((err) => {
    console.error(err)
    initMachineBtn.bad("err", 500)
  })
})

// -------------------------------------------------------- TOOLCHANGER 

let tcBtn = new Button(430, 40, 94, 14, 'tc')
tcBtn.onClick(() => {
  if ($(tcBtn.elem).text() == 'close tc') {
    vm.closeTC().then(() => {
      tcBtn.good('ok', 500)
      setTimeout(() => {
        $(tcBtn.elem).text('open tc')
      }, 500)
    }).catch((err) => {
      console.error(err)
      tcBtn.bad('err', 500)
      setTimeout(() => {
        $(tcBtn.elem).text('close tc')
      }, 500)
    })
  } else {
    vm.openTC().then(() => {
      tcBtn.good('ok', 500)
      setTimeout(() => {
        $(tcBtn.elem).text('close tc')
      }, 500)
    }).catch((err) => {
      console.error(err)
      tcBtn.bad('err', 500)
      setTimeout(() => {
        $(tcBtn.elem).text('open tc')
      }, 500)
    })
  }
})
$(tcBtn.elem).text('close tc')

let dropBtn = new Button(430, 70, 94, 14, 'drop T0')
dropBtn.onClick(() => {
  vm.dropTool(0).then(() => {
    dropBtn.good("ok", 500)
  }).catch((err) => { 
    console.error(err)
    dropBtn.bad("err", 500)
  })
})

let pickupBtn = new Button(430, 100, 94, 14, 'pickup T0')
pickupBtn.onClick(() => {
  vm.pickTool(0).then(() => {
    pickupBtn.good("ok", 500)
  }).catch((err) => {
    console.error(err)
    pickupBtn.bad("err", 500)
  })
})

// -------------------------------------------------------- ENDPOINT TEST 

let ep = osap.endpoint()
ep.addRoute(TS.route().portf(0).portf(1).end(), TS.endpoint(0, 0), 512)

let epTestBtn = new Button(240, 130, 104, 14, 'ep test')
epTestBtn.onClick(() => {
  testRun(10).then((res) => {
    console.warn(res)
    epTestBtn.good(`avg ${res}`, 500)
  }).catch((err) => {
    console.log('err')
  })
  /*
  let datagram = Uint8Array.from([12, 24, 36])
  console.warn('begin')
  let start = performance.now()
  ep.write(datagram).then(() => {
    console.log(performance.now() - start)
    console.warn('end')
    epTestBtn.good("resolves")
    console.warn('RESOLVE EP WRITE')
  }).catch((err) => {
    epTestBtn.bad("rejects")
    console.error('EP REJECT')
    console.error(err)
  })
  */
})

let testRun = async (count) => {
  let datagram = Uint8Array.from([12, 24, 36])
  let start = performance.now()
  let avg = 0
  try {
    for (let i = 0; i < count; i++) {
      console.log(`test ${i}`)
      await ep.write(datagram)
      let now = performance.now()
      avg += now - start
      start = now
    }
  } catch (err) {
    throw new Error(err)
  }
  return avg / count
}

let posns = osap.query(TS.route().portf(0).portf(1).end(), TS.endpoint(0, 0), 512)

let qTestBtn = new Button(240, 160, 104, 14, 'query test')
qTestBtn.onClick(() => {
  posns.pull().then((data) => {
    console.warn("query passed", data)
    qTestBtn.good('ok', 200)
  }).catch((err) => {
    console.warn("query fails")
    console.error(err)
    qTestBtn.bad('fail', 200)
  })
})

/*

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

*/

// -------------------------------------------------------- STARTUP LOCAL

let wscVPort = osap.vPort()
wscVPort.name = 'websocket client'
wscVPort.maxSegLength = 1024

let LOGPHY = false

// to test these systems, the client (us) will kickstart a new process
// on the server, and try to establish connection to it.
console.log("making client-to-server request to start remote process,")
console.log("and connecting to it w/ new websocket")
// ok, let's ask to kick a process on the server,
// in response, we'll get it's IP and Port,
// then we can start a websocket client to connect there,
// automated remote-proc. w/ vPort & wss medium,
// for args, do '/processName.js?args=arg1,arg2'

jQuery.get('/startLocal/osapl-usb-bridge.js', (res) => {
  if (res.includes('OSAP-wss-addr:')) {
    let addr = res.substring(res.indexOf(':') + 2)
    if (addr.includes('ws://')) {
      let status = EP.PORTSTATUS.OPENING
      wscVPort.status = () => { return status }
      console.log('starting socket to remote at', addr)
      let ws = new WebSocket(addr)
      // opens, 
      ws.onopen = (evt) => {
        status = EP.PORTSTATUS.OPEN
        // implement rx
        ws.onmessage = (msg) => {
          msg.data.arrayBuffer().then((buffer) => {
            let uint = new Uint8Array(buffer)
            if (LOGPHY) console.log('PHY WSC Recv')
            if (LOGPHY) TS.logPacket(uint)
            wscVPort.receive(uint)
          }).catch((err) => {
            console.error(err)
          })
        }
        // implement tx 
        wscVPort.send = (buffer) => {
          if (LOGPHY) console.log('PHY WSC Send', buffer)
          ws.send(buffer)
        }
      }
      ws.onerror = (err) => {
        status = EP.PORTSTATUS.CLOSED
        console.log('sckt err', err)
      }
      ws.onclose = (evt) => {
        status = EP.PORTSTATUS.CLOSED
        console.log('sckt closed', evt)
      }
    }
  } else {
    console.error('remote OSAP not established', res)
  }
})

