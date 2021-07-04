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
  if(!motorEnableState){
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
  if(motorEnableState){
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
  if(posDisplayRunning){
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
  if(posDisplayRunning){
    posDisplayRunning = false 
  } else {
    posDisplayRunning = true 
    runPosUpdate()
  }
}
posDisplay.onClick(posDisplayKick)

// -------------------------------------------------------- JOGGING 

let jogBox = new JogBox(10, 270, vm, 200)

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

// -------------------------------------------------------- TEMP CONTROLLER 

// working into temps:

//let hotendVm = new TempVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(6).end())
//let hotendPanel = new TempPanel(hotendVm, 350, 10, 220, "hotend")

//let bedVm = new TempVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(9).end())
//let bedPanel = new TempPanel(bedVm, 350, 420, 70, "bed")

// -------------------------------------------------------- LOADCELL CONTROLLER

/*
let loadcellVm = new LoadVM(osap, PK.route().sib(0).pfwd().sib(1).pfwd().sib(1).bfwd(7).end())
//let loadPanel = new LoadPanel(loadcellVm, 350, 830, "HE loadcell")
let readings = [
  [-124000, -137000, -147000, -159000, -171000, -184000, -195000, -225000, -350000],
  [0, -50, -100, -150, -200, -250, -300, -500, -1000]];
loadcellVm.setObservations(readings, 'grams')
*/

// -------------------------------------------------------- Filament Data Gen 

// let dataGen = new FilamentExperiment(vm, hotendVm, loadcellVm, 350, 10)

// -------------------------------------------------------- Stiffness Map Data Gen

//let stiffnessMapper = new StiffnessMapper(vm, loadcellVm, 350, 10)

/*
// this is... kind of buggy. button state sometimes straightforwards, sometimes callback hell
let posBtn = new Button(430, 10, 344, 14, 'pos')
let posLp = false
posBtn.onClick(() => {
  if (posLp) {
    posLp = false
    posBtn.good("stop", 500)
  } else {
    let posPoll = () => {
      if (!posLp) return
      vm.motion.getPos().then((pos) => {
        if (posLp) {
          $(posBtn.elem).text(`X: ${pos.X.toFixed(2)}, Y: ${pos.Y.toFixed(2)}, Z: ${pos.Z.toFixed(2)}, E: ${pos.E.toFixed(2)}`)
          setTimeout(posPoll, 50)
        }
      }).catch((err) => {
        posLp = false
        console.error(err)
        posBtn.bad("err", 1000)
      })
    }
    posLp = true
    posPoll()
  }
})

let speedBtn = new Button(430, 40, 344, 14, 'speed')
let speedLp = false
speedBtn.onClick(() => {
  if (speedLp) {
    speedLp = false
    speedBtn.good("stop", 500)
  } else {
    let poll = () => {
      if (!speedLp) return
      vm.motion.getSpeeds().then((speed) => {
        if (speedLp) {
          $(speedBtn.elem).text(`X: ${speed.X.toFixed(2)}, Y: ${speed.Y.toFixed(2)}, Z: ${speed.Z.toFixed(2)}, E: ${speed.E.toFixed(2)}`)
          setTimeout(poll, 50)
        }
      }).catch((err) => {
        speedLp = false
        console.error(err)
        speedBtn.bad("err", 1000)
      })
    }
    speedLp = true
    poll()
  }
})

let gotoZeroBtn = new Button(360, 160, 94, 14, 'goto zero')
gotoZeroBtn.onClick(() => {
  vm.motion.addMoveToQueue({
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

// -------------------------------------------------------- EXTRUDER TEST

let testStartBtn = new Button(240, 190, 104, 14, 'e test')
let tempPlot = new AutoPlot(360, 190, 420, 200, 'temp (deg c)')
tempPlot.setHoldCount(1000)
let speedPlot = new AutoPlot(360, 400, 420, 200, 'e speed (mm/min)')
speedPlot.setHoldCount(1000)
let loadPlot = new AutoPlot(360, 620, 420, 200, 'e load (n)')
loadPlot.setHoldCount(1000)
let tstLp = false
let eTestLpCnt = 0
let eTestStore = {
  temps: [],
  speeds: [],
  loads: []
}
testStartBtn.onClick(() => {
  if(tstLp){
    tstLp = false
    return
  }
  let lp = () => {
    if(!tstLp){
      testStartBtn.bad("fin", 500)
      console.log(eTestStore)
      //SaveFile(eTestStore, 'json', 'extruderTestData.json')
      return
    }
    vm.pullExtruderTest().then((res) => {
      eTestLpCnt ++
      tempPlot.pushPt([eTestLpCnt, res.temp])
      speedPlot.pushPt([eTestLpCnt, res.speed])
      loadPlot.pushPt([eTestLpCnt, res.load])
      //if(eTestLpCnt % 1 == 0){
        tempPlot.redraw()
        speedPlot.redraw()
        loadPlot.redraw()
      //}
      eTestStore.temps.push(res.temp)
      eTestStore.speeds.push(res.speed)
      eTestStore.loads.push(res.load)
      setTimeout(lp, 0)
    }).catch((err) => {
      console.error(err)
      setTimeout(lp, 10)
    })
  }
  tstLp = true
  lp()
})

// -------------------------------------------------------- MOTION SETTINGS
// todo: should bundle with jog, position query, etc ? or get on with other work

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

let tcBtn = new Button(540, 70, 94, 14, 'tc')
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

// -------------------------------------------------------- LOADCELL

let loadBtn = new Button(540, 100, 95, 14, 'loadcell')
let loadLp = false
loadBtn.onClick(() => {
  if (loadLp) {
    loadLp = false
    return
  }
  let lp = () => {
    if (!loadLp) {
      loadBtn.bad("cancelled", 500)
      return
    }
    vm.loadcell.getReading().then((reading) => {
      $(loadBtn.elem).text(`${reading.toFixed(3)}`)
      setTimeout(lp, 10)
    }).catch((err) => {
      console.error(err)
      loadLp = false
    })
  }
  loadLp = true
  lp()
})
*/