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

import OSAP from '../osapjs/core/osapRoot.js'
import { PK, TS, VT, EP, TIMES } from '../osapjs/core/ts.js'

// the clank 'virtual machine'
import ClankVM from './vms/clankVirtualMachine.js'

import Grid from '../osapjs/client/interface/grid.js' // main drawing API 
import { Button, EZButton, TextBlock, TextInput } from '../osapjs/client/interface/basics.js'
import { delay } from '../osapjs/core/time.js'
import { GCodePanel } from '../osapjs/client/components/gCodePanel.js'
import { AutoPlot } from '../osapjs/client/components/autoPlot.js'

import { JogBox } from '../osapjs/client/components/jogBox.js'
import { SaveFile } from '../osapjs/client/utes/saveFile.js'
import TempPanel from '../osapjs/client/components/tempPanel.js'
import TempVM from './vms/tempVirtualMachine.js'
import LoadVM from './vms/loadcellVirtualMachine.js'
import LoadPanel from '../osapjs/client/components/loadPanel.js'
import FilamentExperiment from '../client/components/filamentExperiment.js'
import StiffnessMapper from '../client/components/bedStiffnessMapper.js'
import MotorVM from './vms/motorVirtualMachine.js'

console.log("hello clank controller")

// the osap root node:
let osap = new OSAP()

let grid = new Grid()

// -------------------------------------------------------- SETUP NETWORK / PORT 

let wscVPort = osap.vPort()

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

jQuery.get('/startLocal/osapSerialBridge.js', (res) => {
  if (res.includes('OSAP-wss-addr:')) {
    let addr = res.substring(res.indexOf(':') + 2)
    if (addr.includes('ws://')) {
      let status = "opening"
      wscVPort.cts = () => {
        if (status == "open") {
          return true
        } else {
          return false
        }
      }
      // start up, 
      console.log('starting socket to remote at', addr)
      let ws = new WebSocket(addr)
      ws.binaryType = "arraybuffer"
      // opens, 
      ws.onopen = (evt) => {
        status = "open"
        // implement rx
        ws.onmessage = (msg) => {
          let uint = new Uint8Array(msg.data)
          wscVPort.receive(uint)
        }
        // implement tx 
        wscVPort.send = (buffer) => {
          if (LOGPHY) console.log('PHY WSC Send', buffer)
          ws.send(buffer)
        }
      }
      ws.onerror = (err) => {
        status = "closed"
        console.log('sckt err', err)
      }
      ws.onclose = (evt) => {
        status = "closed"
        console.log('sckt closed', evt)
      }
    }
  } else {
    console.error('remote OSAP not established', res)
  }
})

// -------------------------------------------------------- THE VM

// vm, 
let vm = new ClankVM(osap)

// ---------------------------------------------- setup routine

// init... should setup basic motion settings and motors 
// when green: machine is setup 
let initBtn = new Button(10, 10, 84, 104, 'setup')
initBtn.red()
initBtn.onClick(async () => {
  // setup motion basics: accel, max rates (defined in virtual machine)
  initBtn.yellow('setting up motion settings')
  try {
    await vm.motion.setup()
  } catch (err) {
    console.error(err)
    initBtn.red('motion setup err, see console')
    return
  }
  // setup motor settings (axis pick, inversion, steps per unit)
  for (let mot in vm.motors) {
    initBtn.yellow(`setting up ${mot} motor...`)
    try {
      await vm.motors[mot].setup()
    } catch (err) {
      console.error(err)
      initBtn.red(`${mot} motor setup err, see console`)
      return
    }
  }
  // enable motors 
  initBtn.yellow(`enabling motors...`)
  if (!motorEnableState) {
    try {
      await toggleMotorEnable()
    } catch (err) {
      console.error(err)
      initBtn.red(`failed to enable motors, see console`)
      return
    }
  }
  // home the machine, 
  // initBtn.yellow(`homing machine...`)
  // try {
  //   await runHomeRoutine()
  // } catch (err) {
  //   console.error(err)
  //   initBtn.red(`failed to home machine, see console`)
  //   return
  // }
  // start position loop (?) 
  posDisplayKick()
  initBtn.green('setup ok')
})

// ---------------------------------------------- motor power toggle 

let motorEnableBtn = new Button(10, 130, 84, 24, 'motors: ?')
motorEnableBtn.red()
let motorEnableState = false
let toggleMotorEnable = async () => {
  if (motorEnableState) {
    try {
      await vm.disableMotors()
      motorEnableState = false
      motorEnableBtn.yellow('motors: disabled')
    } catch (err) {
      motorEnableBtn.red('motor err, see console')
      throw err
    }
  } else {
    try {
      await vm.enableMotors()
      motorEnableState = true
      motorEnableBtn.green('motors: enabled')
    } catch (err) {
      motorEnableBtn.red('motor err, see console')
      throw err
    }
  }
}
motorEnableBtn.onClick(toggleMotorEnable)

// ---------------------------------------------- home routine setup 

let homeBtn = new Button(10, 170, 84, 24, 'home: ?')
homeBtn.red()
let runHomeRoutine = async () => {
  homeBtn.yellow('awaiting motion end...')
  try {
    await vm.motion.awaitMotionEnd()
  } catch (err) {
    console.error(err)
    homeBtn.red('motion end err, see console')
  }
  homeBtn.yellow('homing Z ...')
  try {
    await vm.homeZ()
  } catch (err) {
    console.error(err)
    homeBtn.red('Z homing err, see console')
  }
  homeBtn.yellow('homing XY ...')
  try {
    await vm.homeXY()
  } catch (err) {
    console.error(err)
    homeBtn.red('XY homing err, see console')
  }
  homeBtn.green('home: ok')
}
homeBtn.onClick(runHomeRoutine)

// ---------------------------------------------- position loop toggle 

let posDisplay = new Button(10, 210, 84, 44, `pos: ?`, true)
posDisplay.red()
posDisplay.setHTML(`X: ?<br>Y: ?<br>Z: ?`)
let posDisplayRunning = false
let runPosUpdate = async () => {
  if (posDisplayRunning) {
    try {
      let pos = await vm.motion.getPos()
      posDisplay.green()
      posDisplay.setHTML(`
        X: ${pos.X.toFixed(2)}<br>
        Y: ${pos.Y.toFixed(2)}<br>
        Z: ${pos.Z.toFixed(2)}
        `)
      setTimeout(runPosUpdate, 10)
    } catch (err) {
      console.error(err)
      posDisplay.red('position update err, see console')
    }
  } else {
    posDisplay.grey()
  }
}
let posDisplayKick = () => {
  if (posDisplayRunning) {
    posDisplayRunning = false
  } else {
    posDisplayRunning = true
    runPosUpdate()
  }
}
posDisplay.onClick(posDisplayKick)

// -------------------------------------------------------- JOGGING 

let jogBox = new JogBox(10, 270, vm, 200)

// -------------------------------------------------------- LOADCELL VM 

let loadcellVm = new LoadVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(9).end())
//let loadPanel = new LoadPanel(loadcellVm, 350, 830, "HE loadcell")
// 0: rear
// 1: front left
// 2: front right
let calibReadings = [
  [[-62200, -52160, -42090, -11900, 38360],
  [0, -100, -200, -500, -1000]],
  [[45650, 57850, 68120, 101780, 158100],
  [0, -100, -200, -500, -1000]],
  [[-28050, -39050, -50050, -83000, -131200],
  [0, -100, -200, -500, -1000]]
]
loadcellVm.setObservations('grams', calibReadings)

let loadTestBtn = new Button(110, 10, 84, 44, 'loadcells', true)
loadTestBtn.onClick(() => {
  if(loadRunning){
    loadRunning = false     
  } else {
    loadRunning = true 
    runLoad()
  }
})
let filts = [0, 0, 0]
let alpha = 0.5
let loadRunning = false
let runLoad = async () => {
  if (loadRunning) {
    try {
      let rds = await loadcellVm.getReading()
      for (let i = 0; i < 3; i++) {
        filts[i] = filts[i] * (1 - alpha) + rds[i] * alpha
      }
      loadTestBtn.setHTML(`
    0: ${filts[0].toFixed(2)}<br>
    1: ${filts[1].toFixed(2)}<br>
    2: ${filts[2].toFixed(2)}
    `)
      loadTestBtn.green()
      setTimeout(runLoad, 10)
    } catch (err) {
      console.log(err)
      loadTestBtn.red('err')
    }
  } else {
    loadTestBtn.grey()
  }
}

// -------------------------------------------------------- SERVO / TC

let servoTestBtn = new EZButton(110, 70, 84, 14, 'toolchanger')
let servoState = 'closed'
servoTestBtn.onClick(() => {
  if (servoState == 'closed') {
    vm.openTC().then(() => {
      servoTestBtn.good("opened", 400)
      servoState = 'opened'
    }).catch((err) => {
      console.error(err)
      servoTestBtn.bad("err")
    })
  } else {
    vm.closeTC().then(() => {
      servoTestBtn.good("closed", 400)
      servoState = 'closed'
    }).catch((err) => {
      console.error(err)
      servoTestBtn.bad("err")
    })
  }
})

// -------------------------------------------------------- HEATBED

let bedVm = new TempVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(10).end())
let bedPanel = new TempPanel(bedVm, 210, 10, 70, "bed")

// -------------------------------------------------------- HOTEND 

let hotendVm = new TempVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(11).end())
let hotendPanel = new TempPanel(hotendVm, 210, 410, 220, "hotend")

// -------------------------------------------------------- EXTRUDER 

let extruderMotor = new MotorVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(12).end())
extruderMotor.settings({
  axisPick: 3,
  axisInversion: true,
  SPU: 550,
  currentScale: 0.4
})

// -------------------------------------------------------- Print Systems Setup 

let printSetupBtn = new Button(110, 100, 84, 34, 'setup print systems')
printSetupBtn.onClick(async () => {
  printSetupBtn.yellow('setting up extruder motor')
  try {
    await extruderMotor.setup()
  } catch (err) { 
    console.error(err)
    printSetupBtn.red('e motor setup err, see console')
  }
  printSetupBtn.yellow('setting up heatbed')
  try {
    await bedVm.setPIDTerms([-1.0, 0.0, -2.6])
  } catch (err) {
    console.error(err)
    printSetupBtn.read('heatbed setup err, see console')
  }
  printSetupBtn.yellow('setting up hotend')
  try {
    await hotendVm.setPIDTerms([-1.0, 0.0, -2.6])
  } catch (err) {
    console.error(err)
    printSetupBtn.read('hotend setup err, see console')
  }
  printSetupBtn.green('print systems ok')
})

// printer setup / init 

/*
let gotoStartBtn = new Button(250, 160, 84, 14, 'goto home')
gotoStartBtn.onClick(() => {
  vm.motion.awaitMotionEnd().then(() => {
    return vm.motion.addMoveToQueue({
      position: rearLeftZero,
      rate: 1000
    })
  }).then(() => {
    return vm.motion.awaitMotionEnd()
  }).then(() => {
    gotoStartBtn.good('ok')
  }).catch((err) => {
    console.log(err)
    gotoStartBtn.bad('err')
  })
})

*/

// -------------------------------------------------------- GCODE INPUT 

// panel, 
// let gCodePanel = new GCodePanel(vm, 10, 10)

// -------------------------------------------------------- Filament Data Gen 

// let dataGen = new FilamentExperiment(vm, hotendVm, loadcellVm, 350, 10)

// -------------------------------------------------------- Stiffness Map Data Gen

//let stiffnessMapper = new StiffnessMapper(vm, loadcellVm, 350, 10)