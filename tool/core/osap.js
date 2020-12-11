/*
osap.js

protocol-abiding object, incl. links

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

'use strict'

import VPort from './vport.js'

import { PK, DK, EP, TS, TIMES } from './ts.js'

let LOGERRPOPS = true
let LOGRCRXBS = false
let LOGRX = false
let LOGTX = false
let TIMEOUT = 60

export default function OSAP() {
  // everyone has a name,
  this.name = "unnamed OSAP node"
  this.description = "undescribed OSAP node"
  // the node's virtual ports, and factory for them
  this.vPorts = []
  this.vPort = () => {
    let np = new VPort(this)
    this.vPorts.push(np)
    return np
  }
  // the node's virtual modules, empty atm
  this.vModules = []

  // ------------------------------------------------------ Utility

  this.getTimeStamp = null

  if (typeof process === 'object') {
    const { PerformanceObserver, performance } = require('perf_hooks')
    this.getTimeStamp = () => {
      return performance.now()
    }
  } else {
    this.getTimeStamp = () => {
      return performance.now()
    }
  }


  // alright alright
  /*
  - revroute needs the vp now, because it appends that indice to the top of the route, since we're node centric
  - additionally, ping and others should resolve always with a .returnPath as well as .whatever-else i.e. .time in this case
  */

  let reverseRoute = (pck, vp) => {
    // TODO: as it stands, this doesn't work when any forwarding counts are for
    // indices above 88: the PK.PTR key ! !
    let eop = 0
    for (let i = 0; i < pck.length; i++) {
      if (pck[i] == PK.PTR) {
        eop = i
        break
      }
    }
    if (eop) {
      let route = new Uint8Array(eop - 3) // size of route, to ptr, less 3 for ppack
      if (vp.portTypeKey != PK.PORTF.KEY) throw new Error('need to handle busses here as well')
      // 1st entry is the port of departure,
      route[0] = vp.portTypeKey
      TS.write('uint16', vp.ownIndice(), route, 1, true)
      // for the remaining, write from the tail, read from the next-after-departure,
      let wp = route.length // write ptr starts at end,
      let rp = 6 // read from start
      for (let h = 0; h < 16; h++) { // walk ptr hops
        if (rp >= eop) { // donot walk past end
          break;
        }
        switch (pck[rp]) {
          case PK.PORTF.KEY:
            wp -= PK.PORTF.INC
            for (let p = 0; p < PK.PORTF.INC; p++) {
              route[wp + p] = pck[rp++]
            }
            break;
          case PK.BUSF.KEY:
          case PK.BUSB.KEY:
            wp -= PK.BUSF.INC
            for (let p = 0; p < PKEYS.BUSF.INC; p++) {
              route[wp + p] = pck[rp++]
            }
            break;
          default:
            TS.logPacket(pck)
            throw new Error("couldn't reverse this path")
            break;
        } // end switch
      } // end hops
      if (LOGRX) console.log('RX: REVERSED ROUTE:', route)
      // include the ackSegSize,
      //                         [eop][dk] // eop == ptr
      // this was like [77][path][ptr][dest][acksegsize][checksum]
      let ackSegSize = TS.read('uint16', pck, eop + 2, true)
      if (LOGRX) console.log('RX: ACK SEG SIZE:', ackSegSize)
      return {
        path: route,
        segsize: ackSegSize
      }
    } else {
      throw new Error('no ptr on path reverse traverse')
    }
  }

  // share our current buffer length,
  let write77 = (pck, vPortDeparture) => {
    // forwarding case,
    pck[0] = PK.PPACK
    let bufspace = vPortDeparture.getRXBufferSpace()
    TS.write('uint16', bufspace, pck, 1, true)
    vPortDeparture.lastRXBufferSpaceTransmitted = bufspace // track this, 
  }

  let getOutgoingVPort = (route) => {
    let vp
    let pi = TS.read('uint16', route.path, 1, true)
    if (this.vPorts[pi]) {
      if (this.vPorts[pi].portTypeKey == route.path[0]) {
        vp = this.vPorts[pi]
      }
    }
    if (!vp) {
      return {
        err: true,
        msg: 'no vPort'
      }
    }
    if (!vp.cts()) {
      return {
        err: true,
        msg: 'vPort not cts'
      }
    }
    return vp
  }

  // route: uint8array, segsize: num, payload uint8array
  let writeOutgoingPacket = (route, payload, reject) => {
    let vp = getOutgoingVPort(route)
    if (vp.err) {
      if (reject) {
        console.warn('WOP Reject')
        reject(vp.msg)
      } else {
        console.log(`ERR while writing packet, ${vp.msg}`)
      }
      return
    }
    let pck = new Uint8Array(route.path.length + payload.length + 9)
    if (pck.length > route.segsize) {
      let msg = `pck length ${pck.length} greater than allowable route segsize ${route.segsize}`
      if (reject) {
        reject(msg)
      } else {
        console.log(msg)
      }
      return
    }
    if (route.path[0] != PK.PORTF.KEY) throw new Error('need to handle outgoing busses, apparently')
    // past err-cases, continue
    write77(pck, vp) // buffer size,
    pck.set(route.path.subarray(0, 3), 3) // port of departure following 77,
    pck[6] = PK.PTR // next instruction following departure port,
    pck.set(route.path.subarray(3), 7) // remaining route instructions (if any)
    pck[route.path.length + 4] = PK.DEST // destination at end of route,
    // allowable ack segment size following destination key,
    TS.write('uint16', route.segsize, pck, route.path.length + 5, true)
    // checksum following aass
    TS.write('uint16', payload.length, pck, route.path.length + 7, true)
    // payload
    pck.set(payload, route.path.length + 9)
    if (LOGTX) {
      console.log('TX: wrote packet')
      TS.logPacket(pck)
    }
    // ...
    return {
      vp: vp,
      pck: pck
    }
  }

  // ------------------------------------------------------ OUTGOING HANDLES
  // blind send this data to this route, 
  // datagrams need to contain a DKEY in [0], probably DK.APP
  this.send = (route, datagram) => {
    return new Promise((resolve, reject) => {
      let clear = writeOutgoingPacket(route, datagram, reject)
      if(!clear) {
        console.warn('NOSEND')
        return
      } 
      //console.log(`TX at ${clear.vp.recipRxBufSpace}`)
      clear.vp.phy.send(clear.pck)
      clear.vp.decrimentRecipRxBufSpace()
      resolve()
    })
  }

  // ------------------------------------------------------ PING

  // route arguments are uint8array's & contain no ptr, 1st term is outgoing
  let nextPingID = 1001
  let incrementPingId = () => {
    nextPingID++
    if (nextPingID > 65535) nextPingID = 0
  }
  let pingReqs = []

  this.ping = (route) => {
    return new Promise((resolve, reject) => {
      if (LOGTX) console.log('TX: Ping: begin')
      // our payload is like,
      let pingReq = new Uint8Array(3)
      pingReq[0] = DK.PINGREQ
      TS.write('uint16', nextPingID, pingReq, 1, true)
      // wrap that into a packet, also finds vPort from route info
      let clear = writeOutgoingPacket(route, pingReq, reject)
      if (!clear) return
      // mechanisms,
      let rejected = false
      pingReqs.push({
        id: nextPingID,
        startTime: this.getTimeStamp(),
        resolve: (res) => {
          if (!rejected) resolve(res)
        }
      })
      // ship it
      if (LOGTX) console.log('TX: Ping: sending')
      clear.vp.phy.send(clear.pck)
      clear.vp.decrimentRecipRxBufSpace()
      setTimeout(() => {
        rejected = true
        reject(`ping timeout to ${route.path}`)
      }, TIMEOUT)
      // increment req nums
      incrementPingId()
    })
  }

  // *responses* to our pings
  // pck[ptr] == DK.PINGRES
  // TODO: move into fn in pingReqs.push()
  let handlePingResponse = (pck, ptr, vp, p) => {
    let id = TS.read('uint16', pck, ptr + 1, true)
    for (let p of pingReqs) {
      if (p.id == id) {
        p.resolve({
          route: {
            path: pck.slice(3, ptr - 6),
            segsize: TS.read('uint16', pck, ptr - 4, true)
          },
          time: this.getTimeStamp() - p.startTime
        })
      }
    }
    vp.rxbuffer.splice(p, 1)
  }

  // *requests to us* to ping
  let handlePingRequest = (pck, ptr, vp, p, ackSegSize) => {
    // we can only flush this from our rx buffer if we
    // are clear to send back up the vp, so
    // this will keep it in the buffer, we'll chain all
    // the way back here next time to check...
    if (!vp.cts()) {
      if (!vp.phy.status != EP.PORTSTATUS.OPEN) {
        // hope is lost, bail on this packet
        if (LOGERRPOPS) console.log('popping ping request - port to respond on is doa')
        vp.rxbuffer.splice(p, 1)
        return
      } else {
        // just not clear yet to send,
        return
      }
    } else {
      // pop before writing that 77
      vp.rxbuffer.splice(p, 1)
    }
    // generate the reply, ship it
    let pingReply = new Uint8Array(3)
    pingReply[0] = DK.PINGRES
    pingReply[1] = pck[ptr + 1] // same ID,
    pingReply[2] = pck[ptr + 2]
    let route = reverseRoute(pck, vp)
    let clear = writeOutgoingPacket(route, pingReply)
    // jesus a lot can go wrong
    if (!clear) {
      // since checked that the vPort *is* cts,
      if (LOGERRPOPS) console.log('bad write for reply to ping, oddball')
      return // already popped above, so just exit
    }
    // ship-it
    clear.vp.phy.send(clear.pck)
    clear.vp.decrimentRecipRxBufSpace()
  }

  // ------------------------------------------------------ MVC WORK
  // all mvc messages can receive a similar set of errmessages,
  // and we'll ID them together as well, then we can handle all
  // responses and possible errors through one pipe,
  let nextMvcID = 2002
  let incrementMvcID = () => {
    nextMvcID++
    if (nextMvcID > 65535) nextMvcID = 0
  }
  let mvcReqs = []

  // ------------------------------------------------------ QUERY / RESPOND NODE INFORMATION
  // route: {path: bytes-to-endpoint, segsize: max. seglength for packets on this route}
  // then use function built-in arguments object for an array of endpoints to query for here,
  this.query = (route, ...items) => {
    return new Promise((resolve, reject) => {
      // we are an outgoing read request,
      let req = [DK.RREQ, nextMvcID & 255, (nextMvcID >> 8) & 255]
      // items -> uppercase,
      // write out a packet of endpoint keys for each item
      // if ever find an error, we terminate the list
      for (let i = 0; i < items.length; i++) {
        if (EP[items[i].toUpperCase()]) {
          if (EP[items[i].toUpperCase()].ISDIVE) {
            // tree depth jump, provide indice
            if (typeof items[i + 1] !== 'number') {
              reject('requested indice-selecting information, did not provide indice, check query arguments')
              return
            } else {
              req.push(EP[items[i].toUpperCase()].KEY, items[i + 1] & 255, (items[i + 1] >> 8) & 255)
              i++
            }
          } else {
            // same level, just key
            req.push(EP[items[i].toUpperCase()].KEY)
          }
        } else {
          reject('unrecognized key requested in call to query, check arguments')
          return
        }
      } // finish loop over items
      // packetize and ship-it
      req = Uint8Array.from(req)
      let clear = writeOutgoingPacket(route, req, reject)
      if (!clear) return
      // shipment mechanisms,
      let rejected = false
      mvcReqs.push({
        id: nextMvcID,
        items: items,
        response: (res) => {
          if (!rejected) resolve(res)
        },
        reject: (msg) => {
          if (!rejected) reject(msg)
        }
      })
      // ship,
      if (LOGTX) console.log('TX: RREQ: sending')
      clear.vp.phy.send(clear.pck)
      clear.vp.decrimentRecipRxBufSpace()
      setTimeout(() => {
        rejected = true
        reject(`read req timeout to ${route.path}`)
      }, TIMEOUT)
      // increment req id
      incrementMvcID()
    })
  } // end query

  // ------------------------------------------------------ READ REQUESTS
  // pck[ptr] = DK.RREQ
  let handleReadRequest = (pck, rptr, vp, p) => {
    // id's, all of them:
    if (LOGRX) console.log("HANDLE READ REQ")
    // if the response path isn't clear, we should exit and leave it in the buffer for next loop,
    if (!vp.cts()) {
      if (!vp.phy.status != EP.PORTSTATUS.OPEN) {
        if (LOGERRPOPS) console.log('popping read request - port to respond on is doa')
        vp.rxbuffer.splice(p, 1)
        return
      } else {
        return // next time!
      }
    }
    // we're ready to respond, so we can prep the reverse route, to know allowable return size
    vp.rxbuffer.splice(p, 1)
    let route = reverseRoute(pck, vp)
    // start response to this read w/ the read-response key, and copy in the id from the packet,
    let reply = new Uint8Array(8192)
    reply[0] = DK.RRES
    reply[1] = pck[rptr + 1]
    reply[2] = pck[rptr + 2]
    // now we walk for keys,
    rptr += 3 // read-ptr now at first endpoint key,
    let wptr = 3 // write-ptr at end of our current reply,
    let obj = this // at the head, we are querying the node itself,
    let indice = null
    // walk ptrs, max 32 queries in one packet, arbitrary
    keywalk: for (let i = 0; i < 32; i++) {
      // if we've written past the allowable return length, query needs to be finer grained
      if (wptr + route.path.length + 3 > route.segsize) {
        console.log("QUERY DOWN")
        reply[3] = EP.ERR.KEY
        reply[4] = EP.ERR.KEYS.QUERYDOWN
        wptr = 5
        break keywalk;
      }
      // if we've read past the end of the request, we're done
      if (rptr >= pck.length) {
        if (LOGRX) console.log("READ REQ COMPLETE")
        break keywalk;
      }
      // to write in null-returns
      let writeEmpty = () => {
        reply[wptr++] = EP.ERR.KEY
        reply[wptr++] = EP.ERR.KEYS.EMPTY
      }
      // ok, walk those keys
      switch (pck[rptr]) {
        // ---------------------------------------------------------- DIVES
        // first up, handle dives, which select down- the tree
        case EP.VPORT.KEY:
          indice = TS.read('uint16', pck, rptr + 1, true)
          if (this.vPorts[indice] && obj == this) { // only if it exists, and only exists at node level
            obj = this.vPorts[indice] // select this for next queries,
            reply[wptr++] = EP.VPORT.KEY // identify that the response's next items are for this item,
            reply[wptr++] = pck[rptr + 1]
            reply[wptr++] = pck[rptr + 2]
            rptr += 3
          } else {
            writeNull()
            break keywalk; // this is terminal for the key walk: succeeding arguments are now null
          }
          break;
        case EP.VMODULE.KEY:
          indice = TS.read('uint16', pck, rptr + 1, true)
          if (this.vModules[indice] && obj == this) {
            obj = this.vModules[indice] // select this for next queries,
            reply[wptr++] = EP.VMODULE.KEY
            reply[wptr++] = pck[rptr + 1]
            reply[wptr++] = pck[rptr + 2]
            rptr += 3
          } else {
            writeEmpty()
            break keywalk; // this is terminal for the key walk: succeeding arguments are now null
          }
          break;
        case EP.INPUT.KEY:
          indice = TS.read('uint16', pck, rptr + 1, true)
          if (obj.inputs && obj.inputs[indice]) {
            obj = obj.inputs[indice]
            reply[wptr++] = EP.INPUT.KEY
            reply[wptr++] = pck[rptr + 1]
            reply[wptr++] = pck[rptr + 2]
            rptr += 3
          } else {
            writeEmpty()
            break keywalk; // this is terminal for the key walk: succeeding arguments are now null
          }
          break;
        case EP.OUTPUT.KEY:
          indice = TS.read('uint16', pck, rptr + 1, true)
          if (obj.outputs && obj.outputs[indice]) {
            reply[wptr++] = EP.OUTPUT.KEY
            reply[wptr++] = pck[rptr + 1]
            reply[wptr++] = pck[rptr + 2]
            rptr += 3
          } else {
            writeEmpty()
            break keywalk; // this is terminal for the key walk: succeeding arguments are now null
          }
          break;
        case EP.ROUTE.KEY:
          indice = TS.read('uint16', pck, rptr + 1, true)
          if (obj.routes && obj.routes[indice]) {
            reply[wptr++] = EP.ROUTE.KEY
            reply[wptr++] = pck[rptr + 1]
            reply[wptr++] = pck[rptr + 2]
            rptr += 3
          } else {
            writeEmpty()
            break keywalk; // this is terminal for the key walk: succeeding arguments are now null
          }
          break;
        // -------------------------------------------------------- COUNTS
        // now, handle all counts-of-things:
        case EP.NUMVPORTS.KEY:
          if (obj == this) {
            reply[wptr++] = EP.NUMVPORTS.KEY
            wptr += TS.write('uint16', this.vPorts.length, reply, wptr, true)
            rptr++
          } else { // only the node has a list of vPorts & vModules,
            writeEmpty()
            rptr++
          }
          break;
        case EP.NUMVMODULES.KEY:
          if (obj == this) {
            reply[wptr++] = EP.NUMVMODULES.KEY
            wptr += TS.write('uint16', this.vModules.length, reply, wptr, true)
            rptr++
          } else { // only the node has a list of vPorts & vModules,
            writeEmpty()
            rptr++
          }
          break;
        case EP.NUMINPUTS.KEY:
          if (obj.inputs) {
            reply[wptr++] = EP.NUMINPUTS.KEY
            wptr += TS.write('uint16', obj.inputs.length, reply, wptr, true)
            rptr++
          } else { // only the node has a list of vPorts & vModules,
            writeEmpty()
            rptr++
          }
          break;
        case EP.NUMOUTPUTS.KEY:
          if (obj.outputs) {
            reply[wptr++] = EP.NUMOUTPUTS.KEY
            wptr += TS.write('uint16', obj.outputs.length, reply, wptr, true)
            rptr++
          } else { // only the node has a list of vPorts & vModules,
            writeEmpty()
            rptr++
          }
          break;
        case EP.NUMROUTES.KEY:
          if (obj.routes) {
            reply[wptr++] = EP.NUMROUTES.KEY
            wptr += TS.write('uint16', obj.routes.length, reply, wptr, true)
            rptr++
          } else { // only the node has a list of vPorts & vModules,
            writeEmpty()
            rptr++
          }
          break;
        // ---------------------------------------------------------- ENDPOINTS
        // now, handle all possible endpoint properties
        case EP.NAME.KEY: // everyone has 1
          reply[wptr++] = EP.NAME.KEY
          wptr += TS.write('string', obj.name, reply, wptr, true)
          rptr++
          break;
        case EP.DESCRIPTION.KEY:
          if (obj.description) { // exists, write in
            reply[wptr++] = EP.DESCRIPTION.KEY
            wptr += TS.write('string', obj.description, reply, wptr, true)
            rptr++
          } else { // null key: this doesn't exist
            writeEmpty()
            rptr++
          }
          break;
        // ------------------------------------------------ PORT SPECIFIC
        case EP.PORTTYPEKEY.KEY:
          if (obj.portTypeKey) {
            reply[wptr++] = EP.PORTTYPEKEY.KEY
            reply[wptr++] = obj.portTypeKey
            rptr++
          } else {
            writeEmpty()
            rptr++
          }
          break;
        case EP.MAXSEGLENGTH.KEY:
          if (obj.phy && obj.phy.maxSegLength) {
            reply[wptr++] = EP.MAXSEGLENGTH.KEY
            wptr += TS.write('uint32', obj.phy.maxSegLength, reply, wptr, true)
            rptr++
          } else {
            writeEmpty()
            rptr++
          }
          break;
        case EP.PORTSTATUS.KEY:
          if (obj.phy) {
            reply[wptr++] = EP.PORTSTATUS.KEY
            reply[wptr++] = obj.phy.status
            rptr++
          } else {
            writeEmpty()
            rptr++
          }
          break;
        case EP.PORTBUFSPACE.KEY:
          if (obj.getRXBufferSpace) {
            reply[wptr++] = EP.PORTBUFSPACE.KEY
            wptr += TS.write('uint16', obj.getRXBufferSpace(), reply, wptr, true)
            rptr++
          } else {
            writeEmpty()
            rptr++
          }
          break;
        case EP.PORTBUFSIZE.KEY:
          if (obj.getRXBufferSize) {
            reply[wptr++] = EP.PORTBUFSIZE.KEY
            wptr += TS.write('uint16', obj.getRXBufferSize(), reply, wptr, true)
            rptr++
          } else {
            writeEmpty()
            rptr++
          }
          break;
        // ------------------------------------------------ INPUT / OUTPUT SPECIFIC
        case EP.TYPE.KEY:
        case EP.VALUE.KEY:
        case EP.STATUS.KEY:
        // ------------------------------------------------ OUTPUT SPECIFIC
        case EP.NUMROUTES.KEY:
        case EP.ROUTE.KEY:
          writeEmpty()
          rptr++
          break;
        // ------------------------------------------------ DEFAULT
        // we don't know what this key is, at all,
        // unfortunately that means it might contain some indice following,
        // which could result in errors, so the whole message is cancelled
        // this will mean that all endpoints will have to at least recognize all keys...
        // here, the protocol is *close* to being an abstract model-retrieval and announcement,
        // but we'll see what happens with compound typing, perhaps provides a model for this as well
        // allowing us to discover arbitrary endpoint properties, dataflow or not...
        default:
          console.log("READ REQ: NONRECOGNIZED KEY", pck[rptr], 'at rptr', rptr)
          TS.logPacket(pck)
          reply[3] = EP.ERR.KEY
          reply[4] = EP.ERR.KEYS.UNCLEAR
          wptr = 5
          break keywalk;
      } // end switch
    } // end keywalk
    reply = Uint8Array.from(reply.subarray(0, wptr))
    let clear = writeOutgoingPacket(route, reply)
    if (!clear) {
      if (LOGERRPOPS) console.log('bad write of packet for read response, oddball, should be clear')
      // already rm'd from the input buffer,
      return
    } else {
      clear.vp.phy.send(clear.pck)
      clear.vp.decrimentRecipRxBufSpace()
    }
  }

  // ------------------------------------------------------ READ RESPONSES
  // pck[ptr] = DK.RRES
  let handleReadResponse = (res, ptr, vp, p) => {
    // all responses should have IDs trailing the D-Key, and should be associated w/ one we're tracking
    let id = TS.read('uint16', res, ptr + 1, true)
    let tracked = mvcReqs.find((cand) => { return cand.id == id })
    ptr += 3
    vp.rxbuffer.splice(p, 1) // errs or not, they all go home (to sleep, the long nap, may you meet the garbage collector in peace)
    if (!tracked) {
      if (LOGERRPOPS) console.error('response to untracked request, popping')
    } else {
      // res[ptr] == 1st key, id is matched and passed
      // response is contextual to items, so,
      let result = {
        route: {
          path: res.slice(3, ptr - 9),
          segsize: TS.read('uint16', res, ptr - 7, true)
        },
        data: {}
      }
      // read response,
      if (res[ptr] == EP.ERR.KEY) { // check halting errors: querydown or unclear query
        if (res[ptr + 1] == EP.ERR.KEYS.QUERYDOWN) {
          reject('querydown')
          return
        } else if (res[ptr + 1] == EP.ERR.KEYS.UNCLEAR) {
          reject('unclear')
          return
        }
      } // end clear errs 
      let rr = {}
      // 1st terms not errors, deserialize
      let items = tracked.items
      itemloop: for (let i = 0; i < items.length; i++) {
        if (ptr >= res.length) break
        // check for null / noread,
        if (res[ptr] == EP.ERR.KEY) {
          if (res[ptr + 1] == EP.ERR.KEYS.EMPTY) {
            result.data[items[i]] = null
            ptr += 2 // increment read pointer
          } else if (res[ptr + 1] == EP.ERR.KEYS.NOREAD) {
            result.data[items[i]] = null
            ptr += 2
          }
        } else if (res[ptr] != EP[items[i].toUpperCase()].KEY) {
          console.warn('out of place key during response deserialization')
          console.warn('have', res[ptr])
          console.warn('expected', EP[items[i].toUpperCase()].KEY)
          break // this is terminal to reading,
        } else {
          // res[rptr] = the item key, so we can read it in,
          if (EP[items[i].toUpperCase()].ISDIVE) {
            // great, we successfully downselected,
            // assuming all queries go down tree before specifying actual endpoints,
            // though that's not baked into any code...
            // and that we are returning an object in place... i.e. response object is contextual to query items
            ptr += 3 // past key and two indices, will ignore,
            i += 1
          } else {
            // the actual endpoint items, 
            switch (items[i]) {
              // ------------------------------------------ COUNTS
              case "numVPorts":
                result.data.numVPorts = TS.read('uint16', res, ptr + 1, true)
                ptr += 3
                break;
              case "numVModules":
                result.data.numVModules = TS.read('uint16', res, ptr + 1, true)
                ptr += 3
                break;
              case "numInputs":
                result.data.numInputs = TS.read('uint16', res, ptr + 1, true)
                ptr += 3
                break;
              case "numOutputs":
                result.data.numOutputs = TS.read('uint16', res, ptr + 1, true)
                ptr += 3
                break;
              case "numRoutes":
                result.data.numOutputs = TS.read('uint16', res, ptr + 1, true)
                ptr += 3
                break;
              // ------------------------------------------ DATA ENDPOINTS
              case "name":
                rr = TS.read('string', res, ptr + 1, true)
                result.data.name = rr.value
                ptr += rr.inc + 1
                break;
              case "description":
                rr = TS.read('string', res, ptr + 1, true)
                result.data.description = rr.value
                ptr += rr.inc + 1
                break;
              case "portTypeKey":
                result.data.portTypeKey = res[ptr + 1]
                ptr += 2
                break;
              case "maxSegLength":
                result.data.maxSegLength = TS.read('uint32', res, ptr + 1, true)
                ptr += 5
                break;
              case "portStatus":
                result.data.portStatus = res[ptr + 1] // is byte-key: 0: closed, 1: open, 2: closing, 3: opening
                ptr += 2
                break;
              case "portBufSpace":
                result.data.portBufSpace = TS.read('uint16', res, ptr + 1, true)
                ptr += 3
                break;
              case "portBufSize":
                result.data.portBufSize = TS.read('uint16', res, ptr + 1, true)
                ptr += 3
                break;
              // TODO need type, value, status, numroutes, route
              default:
                console.warn('WHAT KEY')
                break itemloop;
            } // end switch
          } // end case where item != dive,
        } // end case where res[ptr] = item.key
      } // end loop over items
      tracked.response(result) // return the deserialized items 
    }
  }

  // ------------------------------------------------------ WRITE / RESPOND NODE INFORMATION 
  // so, route ...items, a list of endpoints *with* value arguments 
  // whereas the query has structures like route / tree down-selection / ...individual endpoints 
  // this has similar, route / tree down-selection / ...indidivual (endpoint, writevalue)(pairs!)
  this.write = (route, ...items) => {
    return new Promise((resolve, reject) => {
      // we are an outgoing read request,
      let req = [DK.WREQ, nextMvcID & 255, (nextMvcID >> 8) & 255]
      // items -> uppercase,
      // write out a packet of endpoint keys for each item
      // if ever find an error, we terminate the list
      for (let i = 0; i < items.length; i++) {
        if (EP[items[i].toUpperCase()]) {
          if (EP[items[i].toUpperCase()].ISDIVE) {
            // tree depth jump, provide indice
            if (typeof items[i + 1] !== 'number') {
              reject('requested indice-selecting information, did not provide indice, check query arguments')
              return
            } else {
              req.push(EP[items[i].toUpperCase()].KEY, items[i + 1] & 255, (items[i + 1] >> 8) & 255)
              i++
            }
          } else {
            // same level, key and new-value, 
            // want to check for OK value - set to this endpoint, 
            // TODO - really, should do this with whatever 'typeset' is going to be, 
            // to check values and serialize them - at the moment, just interested in writing a boolean, 
            // and we know this, so, lettuce continue 
            if (typeof items[i + 1] != 'boolean') {
              reject('write-req needs boolean args only atm')
              return
            } else {
              req.push(EP[items[i].toUpperCase()].KEY)
              i++
              if (items[i]) { // adhoc boolean write 
                req.push(1)
              } else {
                req.push(0)
              }
            }
          }
        } else {
          reject('unrecognized key requested in call to query, check arguments')
          return
        }
      } // finish loop over items 
      // packetize and ship it 
      req = Uint8Array.from(req)
      let clear = writeOutgoingPacket(route, req, reject)
      if (!clear) return
      // ship mechanisms 
      let rejected = false
      mvcReqs.push({
        id: nextMvcID,
        items: items,
        response: (res) => {
          if (!rejected) resolve(res)
        },
        reject: (msg) => {
          if (!rejected) reject(msg)
        }
      })
      // ship 
      if (LOGTX) console.log('TX: WREQ: sending')
      clear.vp.phy.send(clear.pck)
      clear.vp.decrimentRecipRxBufSpace()
      setTimeout(() => {
        rejected = true
        reject(`write req timeout to ${route.path}`)
      }, TIMEOUT)
      // increment req id 
      incrementMvcID()
    })
  }

  // ------------------------------------------------------ WRITE REQUESTS 
  // pck[ptr] = DK.WREQ
  let handleWriteRequest = (pck, rptr, vp, p) => {
    if (LOGRX) console.log("HANDLE WRITE REQ")
    // if the response path isn't clear, we leave this in buffer for next turn 
    if (!vp.cts()) {
      if (!vp.phy.status != EP.PORTSTATUS.OPEN) {
        if (LOGERRPOPS) console.log('popping write request - port to respond on is doa')
        vp.rxbuffer.splice(p, 1)
        return
      } else {
        return // next time!
      }
    }
    // ready to resp, we can prep reverse route: want to know allowable return size 
    vp.rxbuffer.splice(p, 1) // we *will* respond in this turn now, so, clear to rm 
    let route = reverseRoute(pck, vp)
    // big uint, will truncate at fin, 
    let reply = new Uint8Array(8192)
    reply[0] = DK.WRES
    reply[1] = pck[rptr + 1] // copy mvcID, direct 
    reply[2] = pck[rptr + 2]
    // now the key walk, 
    rptr += 3 // read-ptr now at first key, 
    let wptr = 3 // write-ptr at end of current reply, 
    let obj = this // at head, logical object being addressed is the osap node (us)
    let indice = null // placeholder, 
    // walk ptrs, 
    keywalk: for (let i = 0; i < 32; i++) {
      // don't write responses longer 
      if (wptr + route.path.length + 3 > route.segsize) {
        console.log("QUERY DOWN")
        reply[3] = EP.ERR.KEY
        reply[4] = EP.ERR.KEYS.QUERYDOWN
        wptr = 5
        break keywalk;
      }
      // if we've read past the end of the request, we're done 
      if (rptr >= pck.length) {
        if (LOGRX) console.log("WRITE REQ COMPLETE")
        break keywalk;
      }
      // to write in null-returns 
      let writeEmpty = () => {
        reply[wptr++] = EP.ERR.KEY
        reply[wptr++] = EP.ERR.KEYS.EMPTY
      }
      // ok, walk 'em 
      switch (pck[rptr]) {
        // ---------------------------------------------------------- DIVES
        // first up, handle dives, which select down- the tree
        // ATM: only support to write to port statuses 
        case EP.VPORT.KEY:
          indice = TS.read('uint16', pck, rptr + 1, true)
          if (this.vPorts[indice] && obj == this) { // only if it exists, and only exists at node level
            obj = this.vPorts[indice] // select this for next queries,
            reply[wptr++] = EP.VPORT.KEY // identify that the response's next items are for this item,
            reply[wptr++] = pck[rptr + 1]
            reply[wptr++] = pck[rptr + 2]
            rptr += 3
          } else {
            writeNull() // that vport doesn't exist 
            break keywalk; // this is terminal for the key walk: succeeding arguments are now null
          }
          break;
        // ------------------------------------------------ PORT SPECIFIC
        case EP.PORTSTATUS.KEY:
          if (obj.phy) {
            if (pck[rptr + 1] > 0) {
              // try open, unless open 
              if (obj.phy.status != EP.PORTSTATUS.OPEN) {
                obj.open() // but don't wait: open requests take time, system will poll 
              }
            } else {
              // set closed, 
              obj.close()
            }
            // writing is actually the same as a read request 
            reply[wptr++] = EP.PORTSTATUS.KEY
            reply[wptr++] = obj.phy.status
            rptr += 2
          } else {
            writeEmpty()
            rptr += 2
          }
          break;
        // ------------------------------------------------ DEFAULT 
        default:
          console.log("WRITE REQ: NONRECOGNIZED KEY", pck[rptr], 'at rptr', rptr)
          TS.logPacket(pck)
          reply[3] = EP.ERR.KEY
          reply[4] = EP.ERR.KEYS.UNCLEAR
          wptr = 5
          break keywalk;
      } // end switch 
    } // end of keywalk 
    reply = Uint8Array.from(reply.subarray(0, wptr))
    let clear = writeOutgoingPacket(route, reply)
    if (!clear) {
      if (LOGERRPOPS) console.log('bad write of packet for write response, oddball, should be clear')
      // already rm'd from input buffer, 
      return
    } else {
      clear.vp.phy.send(clear.pck)
      clear.vp.decrimentRecipRxBufSpace()
    }
  }

  // ------------------------------------------------------ WRITE RESPONSE 
  // pck[ptr] = DK.WRES 
  let handleWriteResponse = (res, ptr, vp, p) => {
    // all responses should have IDs trailing the D-key, should be associated w/ one we're tracking 
    let id = TS.read('uint16', res, ptr + 1, true)
    let tracked = mvcReqs.find((cand) => { return cand.id == id })
    ptr += 3
    vp.rxbuffer.splice(p, 1) // errs or not, clear it 
    if (!tracked) {
      if (LOGERRPOPS) console.error('response to untracked request, popping')
    } else {
      // res[ptr] == 1st key, id is matched and passed 
      // response is contextual to items in the request, 
      let result = {
        route: {
          path: res.slice(3, ptr - 9),
          segsize: TS.read('uint16', res, ptr - 7, true)
        },
        data: {}
      }
      // read the response, 
      if (res[ptr] == EP.ERR.KEY) {
        if (res[ptr + 1] == EP.ERR.KEYS.QUERYDOWN) {
          reject('querydown')
          return
        } else if (res[ptr + 1] == EP.ERR.KEYS.UNCLEAR) {
          reject('unclear')
          return
        }
      } // end clear errs 
      // deserialize 
      let rr = {}
      let items = tracked.items
      itemloop: for (let i = 0; i < items.length; i++) {
        if (ptr > res.length) break
        // check for null / nowrite 
        if (res[ptr] == EP.ERR.KEY) {
          if (res[ptr + 1] == EP.ERR.KEYS.EMPTY) {
            result.data[items[i]] = null
            ptr += 2 // increment read pointer
          } else if (res[ptr + 1] == EP.ERR.KEYS.NOWRITE) {
            result.data[items[i]] = null
            ptr += 2
          }
        } else if (res[ptr] != EP[items[i].toUpperCase()].KEY) {
          console.warn('out of place key during response deserialization')
          console.warn('have', res[ptr])
          console.warn('expected', EP[items[i].toUpperCase()].KEY)
          break // this is terminal to reading,
        } else {
          // res[rptr] = the item key, so we can read this, 
          if (EP[items[i].toUpperCase()].ISDIVE) {
            // successfully downselected, so 
            ptr += 3 // past key and two indices (16 bit) 
            i += 1
          } else {
            // actual endpoint items, 
            switch (items[i]) {
              case "portStatus":
                result.data.portStatus = res[ptr + 1]
                ptr += 2
                i += 1
                break;
              default:
                console.warn('WHAT KEY')
                break itemloop; // terminal error 
            } // end endpoint switch 
          } // end case for item != dive 
        } // end case where res[ptr] = item.key 
      }// end loop over items 
      tracked.response(result) // return the deserialized response 
    }
  }

  // ------------------------------------------------------ HANDLING RX'd PACKS

  // pck[ptr] = DKEY
  // vp is vPort arrived on, p is vp.rxbuffer[p] = pck (to pop)
  // acksegsize is allowable length of return route,
  let handle = (pck, ptr, vp, p) => {
    if (LOGRX) console.log("RX: 5: handle")
    switch (pck[ptr]) {
      case DK.PINGREQ: // ping-request
        handlePingRequest(pck, ptr, vp, p)
        break;
      case DK.PINGRES: // ping-responses
        handlePingResponse(pck, ptr, vp, p)
        break;
      case DK.RREQ: // read-requests
        handleReadRequest(pck, ptr, vp, p)
        break;
      case DK.RRES:
        handleReadResponse(pck, ptr, vp, p)
        break;
      case DK.WREQ: // write-request,
        handleWriteRequest(pck, ptr, vp, p)
        break;
      case DK.WRES: // write-response
        handleWriteResponse(pck, ptr, vp, p)
        break;
      case DK.APP:
        //console.warn("APP")
        if(this.handleAppPackets){
          this.handleAppPackets(pck, ptr, vp, p)
        } else {
          console.warn('app packet, no handler')
          vp.rxbuffer.splice(p, 1)
        }
        break;
      default:
        if (LOGERRPOPS) console.log('unrecognized DKEY, popping')
        vp.rxbuffer.splice(p, 1)
        break;
    }
  }

  // ------------------------------------------------------ FORWARDING

  // pck[ptr] = portf, busf, or busb key
  let forward = (pck, ptr, vp, p) => {
    // fwded to ports only as of now, no js busses exist (but might! rpi uart!)
    if (pck[ptr] != PK.PORTF.KEY) {
      if (LOGERRPOPS) console.log('ERRPOP for non-port forward request, in js, where no busses exist')
      vp.rxbuffer.splice(p, 1)
      return
    }
    // ok,
    let indice = TS.read('uint16', pck, ptr + 1, true)
    let fvp = this.vPorts[indice] // forwarding vPort
    if (fvp) {
      if (fvp.cts()) {
        // currently like:
        //                      [pck[ptr]]
        // [77:3][route][pk.ptr][portf.key][b1][b0][next_instruc]
        // want to do
        // [77:3][route][arrival][b1][b0][pk.ptr][next_instruc]
        // that's a swap in the fixed length, destroying information about where it was forwarded from
        pck[ptr - 1] = PK.PORTF.KEY;
        TS.write('uint16', vp.ownIndice(), pck, ptr, true) // write *arrival port* indice in,
        pck[ptr + 2] = PK.PTR
        // write *the fwding port* flowcontrol term in 
        write77(pck, fvp)
        // now we ship this,
        fvp.phy.send(pck)
        fvp.decrimentRecipRxBufSpace()
        // and remove it from our tracking,
        vp.rxbuffer.splice(p, 1)
      } else {
        if (fvp.phy.status != EP.PORTSTATUS.OPEN) {
          if (LOGERRPOPS) console.log('ERRPOP for forward on closed port')
          vp.rxbuffer.splice(p, 1)
          return
        } else {
          // no-op, wait for cts() onbuffer status
        }
      }
    } else {
      if (LOGERRPOPS) console.log('ERRPOP for port forward on non existent port here', indice)
      vp.rxbuffer.splice(p, 1)
      return
    }
  }

  // ------------------------------------------------------ SCAN RX ROUTINE

  // pck[ptr - 1] == PK.PTR, pck[ptr] is next instruction,
  // vp is vPort rx'd on,
  // vp.rxbuffer[p] = pck, pop this
  let instructionSwitch = (pck, ptr, vp, p) => {
    switch (pck[ptr]) {
      case PK.PORTF.KEY:
      case PK.BUSF.KEY:
      case PK.BUSB.KEY:
        if (LOGRX) console.log('RX: 4: forward')
        forward(pck, ptr, vp, p)
        break;
      case PK.DEST:
        if (LOGRX) console.log('RX: 4: destination land')
        let checksum = TS.read('uint16', pck, ptr + 3, true)
        if (checksum != pck.length - (ptr + 5)) {
          if (LOGERRPOPS) {
            console.warn(`pop due to bad checksum, reported ${checksum} bytes, have ${pck.length - (ptr + 5)}`)
            TS.logPacket(pck)
          }
          vp.rxbuffer.splice(p, 1)
        } else {
          handle(pck, ptr + 5, vp, p)
        }
        break;
      default:
        if (LOGERRPOPS) console.warn(`pop due to unrecognized instruction switch ${pck[ptr + 1]}`)
        vp.rxbuffer.splice(p, 1)
    } // end instruction-switch
  }

  let rxTimer = null 

  this.scanRx = () => {
    // TODO want to round robin the ports, making one attempt per frame, on a fairness-over-ports basis
    // for now, we can be simple
    // also WARNING: logging excessively in this loop (since it's running always - immediately) 
    // can cause keepalive / timer problems. logging takes real time. 
    if (LOGRX) console.log('RX: 1: scanRx')
    let now = this.getTimeStamp()
    // (1) first, do per-port handling of rx buffers
    for (let vp of this.vPorts) {
      let p = 0 // future proofing buffer popping
      let pull = vp.rxbuffer[p]
      if (!pull) continue
      // stale ?
      if(pull.arrivalTime + TIMES.staleTimeout < now){
        // delete
        if(LOGERRPOPS) console.warn(`RX: rm stale message from ${vp.name}`)
        //if(LOGERRPOPS) TS.logPacket(pull.data)
        vp.rxbuffer.splice(p, 1)
        continue 
      }
      // check / handle pack,
      let pck = pull.data 
      let ptr = 0
      if (pck[ptr] == PK.PPACK) {
        vp.recipRxBufSpace = TS.read('uint16', pck, 1, true)
        if (LOGRX || LOGRCRXBS) console.log(`RX: 2: new rcrxbs at ${vp.name}`, vp.recipRxBufSpace)
        if (!(pck.length > 3)) {
          // that's it that's all,
          if (LOGRX) console.log('RX: 2: just rcrxbs, popping')
          vp.rxbuffer.splice(p, 1)
          continue
        } else {
          ptr = 3
        }
      } // end PPACK switch
      // walk for ptr,
      ptrloop: for (let h = 0; h < 16; h++) {
        switch (pck[ptr]) {
          case PK.PTR:
            // do-next-key here
            instructionSwitch(pck, ptr + 1, vp, p)
            break ptrloop;
          case PK.PORTF.KEY:
            // port-previous, keep looking for pointer,
            ptr += PK.PORTF.INC
            break;
          case PK.BUSF.KEY:
            // old instruction to forward on a bus,
            ptr += PK.BUSF.INC
            break;
          case PK.BUSB.KEY:
            // old instruction to broadcast on a bus,
            ptr += PK.BUSB.INC
            break;
          case PK.LLERR:
            // low-level error, escaped from port directly adjacent
            if (LOGRX) console.log("RX: 3: LLERR")
            let str = TS.read('string', pck, ptr + 1, true).value
            console.error('LL ERR:', str)
            vp.rxbuffer.splice(p, 1)
            break ptrloop;
          default:
            // unrecognized, escape !
            if (LOGERRPOPS) {
              TS.logPacket(pck)
              console.warn("pop due to bad walk for ptr")
            }
            vp.rxbuffer.splice(p, 1)
            break ptrloop;
        }
      } // end ptrloop
    } // end for-vp-of-vPorts
    // (2) handle flowcontrol: check if any ports should TX newly opened spaces 
    for (let vp of this.vPorts) {
      let currentRXBufferSpace = vp.getRXBufferSpace()
      if (currentRXBufferSpace > vp.lastRXBufferSpaceTransmitted || vp.lastTxTime + TIMES.txKeepAliveInterval < now) {
        // this port has open space not-reported in the last turn to it's reciprocal, 
        // write ahn 77-out 
        if (vp.cts()) {
          let pck = new Uint8Array(3)
          write77(pck, vp) // this cond'n writes a new transmit timer, 
          vp.phy.send(pck)
          vp.decrimentRecipRxBufSpace()
        }
      } // end need-to-tx 
    }
    // done this loop 
    if(rxTimer) clearTimeout(rxTimer)
    // do we need to check next loop? 
    for (let vp of this.vPorts) {
      if (vp.rxbuffer.length > 0) {
        rxTimer = setTimeout(this.scanRx, 0)
        break;
      }
    } // end check-if-remaining-to-handle
    /*
    // or, run this forever: 
    if(rxTimer) clearTimeout(rxTimer)
    rxTimer = setTimeout(this.scanRx, 0)
    */
  } // end scanRx

  this.onVPortReceive = (vp) => {
    this.scanRx() // could do this w/ one set to rxTimer, calling immediately after stack, 
  }

} // end OSAP
