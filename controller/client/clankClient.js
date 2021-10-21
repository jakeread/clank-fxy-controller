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
import PNS from './experiments/printAndSquish.js'

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
  initBtn.yellow('awaiting motion end to setup motion settings...')
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
  //posDisplayKick()
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

let homeBtn = new Button(10, 170, 84, 34, 'home: ?')
homeBtn.red()
let runHomeRoutine = async () => {
  homeBtn.yellow('homing...')
  vm.home()
  homeBtn.green('home: ok')
}
homeBtn.onClick(runHomeRoutine)

// 214, 162, 111

// ---------------------------------------------- position loop toggle 

let posDisplay = new Button(10, 220, 84, 44, `pos: ?`, true)
//posDisplay.red()
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

let jogBox = new JogBox(10, 300, vm, 200)

// -------------------------------------------------------- All Zero

let zeroSetBtn = new EZButton(10, 550, 84, 14, 'set XYZ zero')
zeroSetBtn.onClick(() => {
  vm.motion.setPos({ X: 0, Y: 0, Z: 0 }).then(() => {
    zeroSetBtn.good("all set 0", 750)
  }).catch((err) => {
    console.error(err)
    zeroSetBtn.bad("err, see console")
  })
})

// -------------------------------------------------------- XY Zero

let centerSetBtn = new EZButton(10, 580, 84, 14, 'set XY zero')
centerSetBtn.onClick(() => {
  vm.motion.getPos().then((pos) => {
    return vm.motion.setPos({
      X: 0, Y: 0,
      Z: pos.Z
    })
  }).then(() => {
    centerSetBtn.good('xy set 0', 750)
  }).catch((err) => {
    console.error(err)
    centerSetBtn.bad("err, see console")
  })
})

// -------------------------------------------------------- Z Zero 

let zZeroSetBtn = new EZButton(10, 610, 84, 14, 'set Z zero')
zZeroSetBtn.onClick(() => {
  vm.motion.setZ(0).then(() => {
    zZeroSetBtn.good("z set 0", 750)
  }).catch((err) => {
    console.error(err)
    zZeroSetBtn.bad("err, see console")
  })
})

// -------------------------------------------------------- goto zero 

let gotoZeroBtn = new EZButton(10, 640, 81, 14, 'goto zero')
gotoZeroBtn.onClick(async () => {
  try {
    await vm.motion.awaitMotionEnd()
    await vm.motion.setWaitTime(10)
    await vm.motion.addMoveToQueue({
      position: {
        X: 0, Y: 0, Z: 0
      },
      rate: 50
    })
    await vm.motion.awaitMotionEnd()
    await vm.motion.setWaitTime(1000)
    gotoZeroBtn.good("ok")
  } catch (err) {
    gotoZeroBtn.bad("err!")
    console.error(err)
  }
})

// -------------------------------------------------------- SERVO / TC

let servoTestBtn = new EZButton(10, 690, 84, 14, 'toolchanger')
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

// -------------------------------------------------------- E Disable 

let eDisableBtn = new EZButton(10, 720, 84, 14, 'switch E pwr')
let eState = 'enabled'
eDisableBtn.onClick(() => {
  if (eState == 'disabled') {
    vm.motors.E.enable().then(() => {
      eDisableBtn.good('enabed', 750)
      eState = 'enabled'
    }).catch((err) => {
      console.error(err)
      eDisableBtn.bad('err')
    })
  } else {
    vm.motors.E.disable().then(() => {
      eDisableBtn.good('disabled', 750)
      eState = 'disabled'
    }).catch((err) => {
      console.error(err)
      eDisableBtn.bad('err')
    })
  }
})

// -------------------------------------------------------- Bed Loadcells

let BedLoadVm = new LoadVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(9).end())

// FR, FL, RC
let loadCalib = [
  // FR:
  [
    [-59700, -79850, -110200, -160500, -210900],
    [0, 200, 500, 1000, 1500]
  ],
  // FL:
  [
    [52100, 74500, 108750, 164750, 221150],
    [0, 200, 500, 1000, 1500]
  ],
  // RC:
  [
    [-24400, -2350, 30700, 85700, 140650],
    [0, 200, 500, 1000, 1500]
  ],
]

BedLoadVm.setObservations('grams', loadCalib)

let ltb = new EZButton(570, 280, 84, 84, 'load')
ltb.onClick(() => {
  let upd8 = () => {
    BedLoadVm.getReading().then((data) => {
      //console.log(data)
      ltb.setText((data[0] + data[1] + data[2] / 3).toFixed(2))
      upd8()
    }).catch((err) => {
      console.error(err)
      ltb.bad()
    })
  }
  upd8()
})

// -------------------------------------------------------- Bed Heater Module

let BedHeaterVM = new TempVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(18).end())

let BedPanel = new TempPanel(BedHeaterVM, 450, 10, 60, 'bed')

// -------------------------------------------------------- Hotend Heater Module

let HotendVM = new TempVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(17).end())

let HotendPanel = new TempPanel(HotendVM, 450, 400, 210, 'hotend', false, true)

// -------------------------------------------------------- Hotend Loadcell

let HotendLoadVM = new LoadVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(13).end())

// -------------------------------------------------------- GCode Input

let gCodePanel = new GCodePanel(120, 10, 300, vm, HotendVM)
// to load on restart...
gCodePanel.loadServerFile('save/3p30mm_pacman.gcode').then(() => {
  console.log("gcode initial file load OK")
}).catch((err) => {
  console.error("failed to load default gcode from server")
})
// 'save/daikon-01.gcode'
// 'save/daikon-truncate.gcode'
// 'save/daikon-noz-step.gcode'
// 'save/pcbmill-stepper.gcode' 114kb
// 'save/3dp-zdrive-left.gcode' 15940kb (too big for current setup)
// 'save/clank-lz-bed-face.gcode'
// 'save/3dp-10mmbox.gcode'

// -------------------------------------------------------- STUB
// this is what you write next...

// le print-n-squish 
let pns = new PNS(vm, HotendVM, BedHeaterVM, BedLoadVm, gCodePanel)
let brb = new EZButton(450, 280, 84, 84, 'runtime')
brb.onClick(() => {
  pns.runTest(220, 40).then(() => {
    brb.good()
  }).catch((err) => {
    console.error(err)
    brb.bad()
  })
})