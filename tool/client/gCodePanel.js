/*
gCodePanel.js

input gcodes 

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

/*
notes on this thing

this is pretty straightforward at the moment, it'll read small gcodes
i.e. those used to mill circuits. for larger files, like 3DP files,
reading times / manipulating large streams of texts needs to be handled 
more intelligently, i.e. not rendering the whole file into the 'incoming' body. 

*/

'use strict'

import { Output, Input } from '../core/modules.js'
import dt from './drawing/domtools.js'

function GCodePanel(xPlace, yPlace) {
    // home dom
    let dom = $('.plane').get(0)

    // previously, in, incoming, etc 
    let domx = xPlace
    let domwidth = 220
    let yspace = 10
    let yplace = yPlace
    // previous gcodes thru 
    let previously = $('<textarea>').addClass('inputwrap')
        .attr('wrap', 'off')
        .attr('readonly', 'true')
        .get(0)
    placeField(previously, domwidth, 200, domx, yplace)
    // optional manual type/feed 
    let lineIn = $('<input>').addClass('inputwrap')
        .get(0)
    placeField(lineIn, domwidth, 20, domx, yplace += 200 + yspace)
    // run / stop 
    let runStop = $('<div>').addClass('button')
        .text('run')
        .get(0)
    placeField(runStop, 44, 14, domx, yplace += 20 + yspace) // 3px padding
    // one line 
    let once = $('<div>').addClass('button')
        .text('once')
        .get(0)
    placeField(once, 44, 14, domx + 60, yplace)
    // load 
    let load = $('<input type = "file">')
        .on('change', (evt) => {
            let reader = new FileReader()
            reader.onload = () => {
                let text = reader.result
                console.log(`loaded file with len ${text.length}`)
                incoming.value = text
            }
            reader.readAsText(evt.target.files[0])
            console.log('load', evt.target.files[0])
        })
        .get(0)
    placeField(load, 94, 20, domx + 120, yplace)
    // incoming gcodes 
    let incoming = $('<textarea>').addClass('inputwrap')
        .attr('wrap', 'off')
        .get(0)
    placeField(incoming, domwidth, 460, domx, yplace += 20 + yspace)

    // startup with, 
    // 'save/pcbmill-stepper.gcode' 114kb
    // 'save/3dp-zdrive-left.gcode' 15940kb (too big for current setup)
    initWith('save/clank-lz-bed-face.gcode').then((res) => {
        incoming.value = res
    }).catch((err) => {
        console.error(err)
    })

    // for this runtime, we need a port to throw moves onto, 
    // that should have similar properties to old CF things:
    // ... 
    // I also need to determine a type for that, maybe I want typescript in here. 
    // first, I need to think up what kinds of things I'm going to be sending to saturn 
    // setup has 'axis order', to pick X, Y, Z, etc, that's a string / csv list 
    // move: {pos: [], rate: <num>} units/s ... that it? saturn is responsible for accel vals etc 

    this.moveOut = new Output()
    this.spindleOut = new Output()
    this.awaitMotionEnd = new Output()

    // thru-feed: pull from incoming, await, push to previous 
    let thruFeed = () => {
        return new Promise((resolve, reject) => {
            let eol = incoming.value.indexOf('\n') + 1
            // if end of file & no new-line terminating, 
            if(eol == 0) eol = incoming.value.length 
            let line = incoming.value.substring(0, eol)
            lineIn.value = line
            // should check if is end of file 
            if(incoming.value.length == 0){
                resolve(true)
                return 
            }
            // otherwise parse 
            parse(line).then(() => {
                // success, clear and add to prev 
                lineIn.value = ''
                previously.value += line
                previously.scrollTop = previously.scrollHeight
                resolve(false)
                //resolve()
            }).catch((err) => {
                // failure, backup 
                console.error('err feeding', line, err)
                lineIn.value = ''
                incoming.value = line.concat(incoming.value)
                reject()
            })
            incoming.value = incoming.value.substring(eol)
        })
    }
    // one line increment... ad 'hold' flag when awaiting ? 
    // could match globally: whenever awaiting processing... set red 
    $(once).on('click', (evt) => {
        thruFeed().then(() => {
            //console.log('thru')
        }).catch((err) => {
            console.error(err)
        })
    })
    // then we need loops... 
    let running = false
    $(runStop).on('click', (evt) => {
        if (running) {
            running = false
            $(runStop).text('run')
        } else {
            running = true
            $(runStop).text('stop')
            run()
        }
    })
    // the loop, 
    let run = async () => {
        while (running) {
            try {
                let complete = await thruFeed()
                if (complete) {
                    running = false
                    $(runStop).text('run')
                } else {
                    // inserts a break in js event system, important 
                    await new Promise((resolve, reject) => {
                        setTimeout(resolve, 0)
                    })
                }
            } catch (err) {
                console.error(err)
                running = false
            }
        }
    }

    // the actual gcode parsing, 
    let axesString = "X, Y, Z" // delivered to Saturn in this order 
    let axes = pullAxes(axesString)
    let position = {}
    for (let axis of axes) {
        position[axis] = 0.0
    }
    console.log(position)
    let feedRates = { // in mm/sec: defaults if not set 
        G00: 10, // rapids
        G01: 5 // feeds 
    }
    let feedMode = 'G01'
    let posConvert = 1 // to swap mm / inches if G20 or G21 
    let feedConvert = 1 // to swap units/s and units/inch ... 
    let parse = async (line) => {
        if(line.length == 0){
            return 
        }
        let move = false
        let words = stripComments(line).match(re) || []
        if (words.length < 1) return
        // single feed: sets all feedrates 
        if (words[0].includes('F')) {
            let feed = parseFloat(words[0].substring(1))
            if (Number.isNaN(feed)) {
                console.error('NaN for GCode Parse Feed')
            } else {
                for (let f in feedRates) {
                    feedRates[f] = feed
                }
            }
            return
        } // end lonely F     
        // do normal pickings 
        switch (words[0]) {
            case 'G20':
                posConvert = 25.4
                feedConvert = 25.4
                return
            case 'G21':
                posConvert = 1
                feedConvert = 1
                return
            case 'G00':
                feedMode = 'G00'
                let g0move = gMove(words)
                await this.moveOut.send(g0move)
                return
            case 'G01':
                feedMode = 'G01'
                let g1move = gMove(words)
                await this.moveOut.send(g1move)
                return
            case 'G28':
                console.warn('HOME ...')
            case 'G92':
                console.warn('SET pos to x..y.. etc')
                break;
            case 'M03':
                // sort of hacked, should do modal rpm-set w/ S 
                // though IDK whomst gcode is doing that, modela? 
                if(words[1]){
                    let rpm = parseFloat(words[1].substring(1))
                    if (Number.isNaN(rpm)) {
                        rpm = 0
                        console.error('bad RPM parse')
                    }    
                    await this.awaitMotionEnd.send()
                    await this.spindleOut.send(rpm)
                }
                break;
            case 'M05':
                await this.awaitMotionEnd.send()
                await this.spindleOut.send(0)
                break;
            default:
                // hack for recognizing Mx-free S-code for spindle, 
                if(words[0].charAt(0) == 'S'){
                    console.warn('Mx Free Spinde Code')
                    let rpm = parseFloat(words[0].substring(1))
                    if(Number.isNaN(rpm)){
                        rpm = 0 
                        console.error('bad RPM parse')
                    }
                    await this.awaitMotionEnd.send()
                    await this.spindleOut.send(rpm)
                } else {
                    console.warn('ignoring GCode', line)
                }
                return
        } // end first word switch     
    } // end parse 

    let gMove = (words) => {
        for (let word of words) {
            for (let axis of axes) {
                if (word.includes(axis)) {
                    let pos = parseFloat(word.substring(1))
                    if (Number.isNaN(pos)) {
                        console.error('NaN for GCode Parse Position')
                    } else {
                        position[axis] = pos
                    }
                }
            } // end check axis in word, 
            if (word.includes('F')) {
                let feed = parseFloat(word.substring(1))
                if (Number.isNaN(feed)) {
                    console.error('NaN for GCode Parse Feed')
                } else {
                    feedRates[feedMode] = feed
                }
            }
        } // end for-words 
        // output the move, 
        let move = { position: {}, rate: feedRates[feedMode] * feedConvert }
        for (let axis of axes) {
            move.position[axis] = position[axis] * posConvert
        }
        return move
    }
}

// reference:
// spy from https://github.com/cncjs/gcode-parser/blob/master/src/index.js thx 
/*
G00:        move at rapids speed 
G01:        move at last G01 F<num>
G04 P<num>:  dwell for P milliseconds or X seconds 
G20:        set coordinates to inches 
G21:        set coordinates to mm 
G28:        do homing routine 
G90:        positions are absolute w/r/t zero 
G91:        positions are incremenetal w/r/t last moves 
G94:        feedrates are per minute 
*/
/*
F<num>:     set feedrate for modal G 
M03 S<num>: set clockwise rotation 
M04 S<num>: set counter-clockwise rotation 
M05:        stop spindle 
M83:        use extruder relative motion 
*/

function Button(xPlace, yPlace, width, height, text) {
    let btn = $('<div>').addClass('button')
        .text(text)
        .get(0)
    placeField(btn, width, height, xPlace, yPlace)
    return btn
}

function TextInput(xPlace, yPlace, width, height, text) {
    let input = $('<input>').addClass('inputwrap').get(0)
    input.value = text
    placeField(input, width, height, xPlace, yPlace)
    return input
}

let BTN_RED = 'rgb(242, 201, 201)'
let BTN_GRN = 'rgb(201, 242, 201)'
let BTN_YLW = 'rgb(240, 240, 180)'
let BTN_GREY = 'rgb(242, 242, 242)'
let BTN_HANGTIME = 1000
let BTN_ERRTIME = 2000

function JogBox(xPlace, yPlace, vm) {
    // jog 
    let jogBtn = Button(xPlace, yPlace, 104, 104, 'click-in to jog')
    let jogBigInput = TextInput(xPlace + 120, yPlace, 60, 20, '10.0')
    let jogNormalInput = TextInput(xPlace + 120, yPlace + 30, 60, 20, '1.0')
    let jogSmallInput = TextInput(xPlace + 120, yPlace + 60, 60, 20, '0.1')
    let status = Button(xPlace + 120, yPlace + 90, 54, 14, '...')
    // key status 
    let zDown = false;
    let setZ = (bool) => {
        zDown = bool
        if (zDown) {
            $(status).text('z')
        } else {
            $(status).text('xy')
            // do... 
        }
    }
    let bigDown = false;
    let setBig = (bool) => {
        bigDown = bool
        if (bigDown) {
            setSmall(false)
            setNormal(false)
            $(jogBigInput).css('background-color', BTN_GRN)
        } else {
            $(jogBigInput).css('background-color', BTN_GREY)
        }
    }
    let normalDown = false;
    let setNormal = (bool) => {
        normalDown = bool
        if (normalDown) {
            setSmall(false)
            setBig(false)
            $(jogNormalInput).css('background-color', BTN_GRN)
        } else {
            $(jogNormalInput).css('background-color', BTN_GREY)
        }
    }
    let smallDown = false;
    let setSmall = (bool) => {
        smallDown = bool
        if (smallDown) {
            setNormal(false)
            setBig(false)
            $(jogSmallInput).css('background-color', BTN_GRN)
        } else {
            $(jogSmallInput).css('background-color', BTN_GREY)
        }
    }
    // clear 
    let noneDown = () => {
        setNormal(false)
        setBig(false)
        setSmall(false)
    }
    // action
    let parseOrReject = (numstr) => {
        let val = parseFloat(numstr)
        if (Number.isNaN(val)) {
            return 0
        } else {
            return val
        }
    }
    let getIncrement = () => {
        let val = 0
        console.log(smallDown, normalDown, bigDown)
        if (smallDown) {
            return parseOrReject(jogSmallInput.value)
        } else if (normalDown) {
            return parseOrReject(jogNormalInput.value)
        } else if (bigDown) {
            return parseOrReject(jogBigInput.value)
        } else {
            console.error('no increment selected, statemachine borked')
            return 0
        }
    }
    let jog = (key, rate) => {
        $(jogBtn).text('...').css('background-color', BTN_YLW)
        vm.awaitMotionEnd().then(() => {
            return vm.setWaitTime(10)
        }).then(() => {
            return vm.queryPosition()
        }).then((pos) => {
            let inc = getIncrement()
            switch (key) {
                case 'left':
                    pos.X -= inc
                    return vm.addMoveToQueue({ position: pos, rate: rate })
                case 'right':
                    pos.X += inc
                    return vm.addMoveToQueue({ position: pos, rate: rate })
                case 'up':
                    if (zDown) {
                        pos.Z += inc
                    } else {
                        pos.Y += inc
                    }
                    return vm.addMoveToQueue({ position: pos, rate: rate })
                case 'down':
                    if (zDown) {
                        pos.Z -= inc
                    } else {
                        pos.Y -= inc
                    }
                    return vm.addMoveToQueue({ position: pos, rate: rate })
                default:
                    console.error('bad key for jog switch')
                    break;
            }
        }).then(() => {
            return vm.awaitMotionEnd()
        }).then(() => {
            return vm.setWaitTime(1000)
        }).then(() => {
            this.restart()
        }).catch((err) => {
            $(jogBtn).text('err').css('background-color', BTN_RED)
            setTimeout(() => { this.restart() }, BTN_ERRTIME)
        })
    }
    // key listeners 
    this.keyDownListener = (evt) => {
        if (evt.repeat) return
        //console.log('keydown', evt.keyCode)
        switch (evt.keyCode) {
            case 90:
                setZ(true)
                break;
            case 88:
                setBig(true)
                break;
            case 67:
                setSmall(true)
                break;
            case 38:
                jog('up', 10)
                break;
            case 40:
                jog('down', 10)
                break;
            case 37:
                jog('left', 10)
                break;
            case 39:
                jog('right', 10)
                break;
            default:
                break;
        }
    }
    // up 
    this.keyUpListener = (evt) => {
        //console.log('keyup', evt.keyCode)
        switch (evt.keyCode) {
            case 90:
                setZ(false);
            case 88:
                setBig(false)
                setNormal(true)
                break;
            case 67:
                setSmall(false)
                setNormal(true)
                break;
            default:
                break;
        }
    }
    // in-to-state
    this.start = () => {
        jogBtn.clicked = true
        $(jogBtn).css('background-color', BTN_GRN)
        $(jogBtn).html('x: big<br>c: small<br>z: map y to z')
        $(status).text('xy')
        document.addEventListener('keydown', this.keyDownListener)
        document.addEventListener('keyup', this.keyUpListener)
        if (bigDown) {
            setBig(true)
        } else if (smallDown) {
            setSmall(true)
        } else {
            setNormal(true)
        }
        if (zDown) {
            $(status).text('z')
        }
    }
    // out-of 
    this.stop = () => {
        jogBtn.clicked = false
        $(jogBtn).html('click-in to jog')
        $(jogBtn).css('background-color', BTN_GREY)
        $(status).text('...')
        noneDown()
        document.removeEventListener('keydown', this.keyDownListener)
        document.removeEventListener('keyup', this.keyUpListener)
    }
    // restart w/ varied button-down state 
    this.restart = () => {
        if (jogBtn.clicked) {
            this.start()
        } else {
            this.stop()
        }
    }
    // go big 
    this.select
    // ok, statemachine 
    $(jogBtn).on('click', (evt) => {
        if (!jogBtn.clicked) {
            this.start()
        } else {
            this.stop()
        }
    })
}

export { GCodePanel, Button, TextInput, JogBox }

// lifted from https://github.com/cncjs/gcode-parser/blob/master/src/index.js
const stripComments = (() => {
    const re1 = new RegExp(/\s*\([^\)]*\)/g); // Remove anything inside the parentheses
    const re2 = new RegExp(/\s*;.*/g); // Remove anything after a semi-colon to the end of the line, including preceding spaces
    const re3 = new RegExp(/\s+/g);
    return (line => line.replace(re1, '').replace(re2, '').replace(re3, ''));
})()
const re = /(%.*)|({.*)|((?:\$\$)|(?:\$[a-zA-Z0-9#]*))|([a-zA-Z][0-9\+\-\.]+)|(\*[0-9]+)/igm

let pullAxes = (str) => {
    const whiteSpace = new RegExp(/\s*/g)
    str = str.replace(whiteSpace, '')
    return str.split(',')
}

let placeField = (field, width, height, xpos, ypos) => {
    $(field).css('position', 'absolute')
        .css('border', 'none')
        .css('width', `${width}px`)
        .css('height', `${height}px`)
    $($('.plane').get(0)).append(field)
    let dft = { s: 1, x: xpos, y: ypos, ox: 0, oy: 0 }
    dt.writeTransform(field, dft)
}

// startup with demo gcode, for testing 
let initWith = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject('no startup file, ok')
            return
        }
        $.ajax({
            type: "GET",
            url: file,
            error: function () { reject(`req for ${file} fails`) },
            success: function (xhr, statusText) {
                resolve(xhr)
            }
        })
    })
}