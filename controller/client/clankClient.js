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
import ClankVM from './vms/clankFXYVirtualMachine.js'

import Grid from '../osapjs/client/interface/grid.js' // main drawing API 
import { Button, EZButton, TextBlock, TextInput } from '../osapjs/client/interface/basics.js'
import { delay } from '../osapjs/core/time.js'
import { GCodePanel } from '../osapjs/client/components/gCodePanel.js'
import AutoPlot from '../osapjs/client/components/autoPlot.js'

import { JogBox } from '../osapjs/client/components/jogBox.js'
import { SaveFile } from '../osapjs/client/utes/saveFile.js'
import TempPanel from '../osapjs/client/components/tempPanel.js'
import TempVM from '../osapjs/vms/tempVirtualMachine.js'
import LoadVM from '../osapjs/vms/loadcellVirtualMachine.js'
import LoadPanel from '../osapjs/client/components/loadPanel.js'
import FilamentExperiment from '../client/components/filamentExperiment.js'
import StiffnessMapper from '../client/components/bedStiffnessMapper.js'

import PNS from './experiments/printAndSquish.js'
import FilamentSensorVM from './vms/filamentSensorVM.js'

console.log("hello clank controller")

// the osap root node:
let osap = new OSAP("clankClient")

let grid = new Grid()

// -------------------------------------------------------- SETUP NETWORK / PORT 

let wscVPort = osap.vPort("wscVPort")

// -------------------------------------------------------- THE VM

// vm, 
let vm = new ClankVM(osap)

// -------------------------------------------------------- Bed Loadcells

let BedLoadVm = new LoadVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(9).end())

// -------------------------------------------------------- Bed Heater Module

let BedHeaterVM = new TempVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(18).end())

// -------------------------------------------------------- Hotend Heater Module

let HotendVM = new TempVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(17).end())

// -------------------------------------------------------- Hotend Loadcell

let HotendLoadVM = new LoadVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(13).end())

// -------------------------------------------------------- Filament Sensor 

//let FilSenseVM = new FilamentSensorVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(16).end())
let FilSenseVM = new FilamentSensorVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().end())

// -------------------------------------------------------- setup routine

// -------------------------------------------------------- Power States 
// also, keepalive & connection indicator 

let kaIndicator = new Button(10, 10, 84, 84, 'connection ?')
kaIndicator.yellow()
let v5State = false 
let v24State = false 
let v5Btn = new Button(10, 110, 84, 44, '5V Power')
let v24Btn = new Button(10, 170, 84, 44, '24V Power')
v24Btn.yellow()
v5Btn.yellow()
let powerTimerLength = 1000  
let powerTimer = {}

// we want to run these on a loop... 
let checkPowerStates = () => {
  vm.motion.getPowerStates().then((data) => {
    kaIndicator.green('Connection OK')
    if(data[0]){
      v5Btn.green('5V Power')
      v5State = true 
    } else {
      v5Btn.grey('5V Power')
      v5State = false 
    }
    if(data[1]){
      v24Btn.green('24V Power')
      v24State = true 
    } else {
      v24Btn.grey('24V Power')
      v24State = false 
    }
    clearTimeout(powerTimer)
    powerTimer = setTimeout(checkPowerStates, powerTimerLength)
  }).catch((err) => {
    console.error(err)
    kaIndicator.red('keepalive broken, see console')
    v5Btn.red('see console')
    v24Btn.red('see console')
  })
}

v5Btn.onClick(async () => {
  v5Btn.yellow()
  await vm.motion.setPowerStates(!v5State, v24State)
  checkPowerStates()
})

v24Btn.onClick(async () => {
  v24Btn.yellow()
  await vm.motion.setPowerStates(v5State, !v24State)
  checkPowerStates()
})

// startup w/ this loop; 
// comment this line out if you don't want the keepalive to bother you while you try 
// hardware-less code stuff 
// powerTimer = setTimeout(checkPowerStates, 1000)

// -------------------------------------------------------- setup routine

// init... should setup basic motion settings and motors 
// when green: machine is setup 
let initBtn = new Button(10, 240, 84, 104, 'setup')
initBtn.red()
initBtn.onClick(async () => {
  // power on 
  initBtn.yellow('powering on...')
  try {
    await vm.motion.setPowerStates(true, true) 
  } catch (err) {
    console.error(err)
    initBtn.red("unable to set power, pls check USB conn")
    return 
  }
  // setup motion basics: accel, max rates (defined in virtual machine)
  initBtn.yellow('awaiting motion setup...')
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
  // done here 
  initBtn.green('setup ok')
})

// ---------------------------------------------- motor power toggle 

let motorEnableBtn = new Button(10, 360, 84, 24, 'motors: ?')
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

let homeBtn = new Button(10, 400, 84, 34, 'home: ?')
homeBtn.red()
let runHomeRoutine = async () => {
  homeBtn.yellow('homing...')
  await vm.home()
  homeBtn.green('home: ok')
}
homeBtn.onClick(runHomeRoutine)

// 214, 162, 111

// ---------------------------------------------- position loop toggle 

let posDisplay = new Button(10, 450, 84, 44, `pos: ?`, true)
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
      //pad.addPoint([pos.X, pos.Y])
      setTimeout(runPosUpdate, 50)
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

let jogBox = new JogBox(440, 10, vm, 1000)

// -------------------------------------------------------- All Zero

let zeroSetBtn = new EZButton(440, 260, 84, 14, 'set XYZ zero')
zeroSetBtn.onClick(() => {
  vm.motion.setPos({ X: 0, Y: 0, Z: 0 }).then(() => {
    zeroSetBtn.good("all set 0", 750)
  }).catch((err) => {
    console.error(err)
    zeroSetBtn.bad("err, see console")
  })
})

// -------------------------------------------------------- XY Zero

let centerSetBtn = new EZButton(440, 290, 84, 14, 'set XY zero')
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

let zZeroSetBtn = new EZButton(440, 320, 84, 14, 'set Z zero')
zZeroSetBtn.onClick(() => {
  vm.motion.setZ(0).then(() => {
    zZeroSetBtn.good("z set 0", 750)
  }).catch((err) => {
    console.error(err)
    zZeroSetBtn.bad("err, see console")
  })
})

// -------------------------------------------------------- goto zero 

let gotoZeroBtn = new EZButton(440, 350, 84, 14, 'goto zero')
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

// -------------------------------------------------------- GCode Consumer 

let gCodePanel = new GCodePanel(120, 10, 300, vm)
// to load on restart...
gCodePanel.loadServerFile('save/tc-repeat-z-test.nc').then(() => {
  console.log("gcode initial file load OK")
}).catch((err) => {
  console.error("failed to load default gcode from server")
})

// -------------------------------------------------------- Panels for Bed and Extruder Heaters

let BedPanel = new TempPanel(BedHeaterVM, 550, 10, 60, 'bed')
let HotendPanel = new TempPanel(HotendVM, 550, 260, 210, 'hotend', false, true)

// -------------------------------------------------------- Extruder Disable 

let eDisableBtn = new EZButton(10, 510, 84, 34, 'switch E pwr')
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

// -------------------------------------------------------- STUB
// this is what you write next...
/*
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
*/

// init w/ 5v power,
setTimeout(() => {
  // vm.motion.setPowerStates(true, false)
}, 500)

let tstBtn = new EZButton(550, 550, 84, 84, 'test !')
tstBtn.onClick(() => {
  FilSenseVM.getReadings().then((data) => {
    console.warn('fil sense reading', data)
    tstBtn.good()
  }).catch((err) => {
    console.error(err)
    tstBtn.bad() 
  })
  return;
  HotendLoadVM.getReading().then((data) => {
    console.warn('load reading...', data)
  }).catch((err) => {
    console.error(err)
  })
  tstBtn.good()
  /*
  filSense.getHallReading().then((reading) => {
    console.warn(reading)
    tstBtn.good()
  }).catch((err) => {
    console.error(err)
    tstBtn.bad()
  })
  */
})

// ------------------------------------ Init the WSC Port 

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