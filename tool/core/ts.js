/*
ts.js // typeset

serialization, keys for OSAP

ends up being a kind of 'core import' for system params 

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

let TIMES = {
  staleTimeout: 600,
  txKeepAliveInterval: 300,
}

// 13: \r
// 10: \n
// these should be clearly delimited as L1 / L2 possible keys...

// packet keys, for l0 of packets,
// PKEYS all need to be on the same byte order, since they're
// walked
// TRANSPORT LAYER
let PK = {
  PPACK: 77, // this and following two bytes are rcrxb size
  PTR: 88, // packet pointer (next byte is instruction)
  DEST: 99, // have arrived, (next bytes are 16b checksum)
  LLERR: 44,
  PORTF: {
    KEY: 11, // actual instruction key,
    INC: 3 // number of bytes in instruction argument + 1 for the key
  },
  BUSF: {
    KEY: 12,
    INC: 5
  },
  BUSB: {
    KEY: 14,
    INC: 5,
  }
}

// ARRIVAL LAYER (what do to once received packet / passed checksum)

// destination keys 
let DK = {
  APP: 100, // next bytes are for your application, 
  PINGREQ: 101, // next byte is ping-id | eop
  PINGRES: 102, // next byte is ping-id | eop
  RREQ: 111, // read request, next byte is request-id, then ENDPOINTS,
  RRES: 112, // response, next byte is request-id, then ENDPOINTS
  WREQ: 113, // write request,
  WRES: 114, // write response,
}

// application keys 
let AK = {
  OK: 100,
  ERR: 200,
  GOTOPOS: 101,
  SETPOS: 102,
  SETCURRENT: 103,
  SETWAITTIME: 104,
  SETRPM: 105,
  QUERYMOVING: 111,
  QUERYPOS: 112,
  QUERYQUEUELEN: 113,
  RUNCALIB: 121,
  READCALIB: 122,
  SET_TC: 123
}

// could do like
// ITEMS.key / .serialize / .deserialize
// the mess is down here
// the idea is that any unique endpoint has one routine to
// serialize / deserialze. these are for the mvc layer,
// typed objects will get a similar set
// perhaps, i.e, some of these should be like 'numinputs'
// or 'numports', etc ... unclear to me how to query down-tree
let EP = {
  ERR: {
    KEY: 150,
    KEYS: {
      QUERYDOWN: 151, // selected chunk too large for single segment, go finer grain
      MSG: 152, // generic error message
      EMPTY: 153, // resource queried for not here
      UNCLEAR: 154, // bad request / query
      NOREAD: 155, // no reading supported for this,
      NOWRITE: 156, // rejected write request: writing not available here
      WRITEREJECT: 157, // writing OK here, but not with this value ?
    }
  },
  // anything can include:
  NAME: {
    KEY: 171,
  },
  DESCRIPTION: {
    KEY: 172,
  },
  // number of vPorts, at node,
  NUMVPORTS: {
    KEY: 181, // count of vPorts at node
  },
  // this vPort (always succeeded by indice)
  VPORT: {
    KEY: 182,
    ISDIVE: true,
  },
  // vPort-unique keys,
  PORTTYPEKEY:{
    KEY: 183,
  },
  MAXSEGLENGTH: {
    KEY: 184, // uint32 num-bytes-per-fwded-pck allowed on this phy
  },
  PORTSTATUS: {
    KEY: 185,
    CLOSED: 0,
    OPEN: 1, 
    CLOSING: 2, 
    OPENING: 3
  },
  PORTBUFSPACE: {
    KEY: 186, // num empty frames in port
  },
  PORTBUFSIZE: {
    KEY: 187,
  },
  // I currently have *no idea* how will handle bus drops:
  // perhaps they are mostly like outputs, in the vPort... typed, have value, ok
  // number of vModules, at node,
  NUMVMODULES:{
    KEY: 201,
  },
  // this vmodule, (always succeeded by indice)
  VMODULE: {
    KEY: 202,
    ISDIVE: true,
  },
  // vPorts, vModules can both have inputs, outputs,
  NUMINPUTS: {
    KEY: 211,
  },
  INPUT: { // this input (always succeeded by indice)
    KEY: 212,
    ISDIVE: true,
  },
  NUMOUTPUTS: {
    KEY: 221,
  },
  OUTPUT: { // this output (always succeeded by indice)
    KEY: 222,
    ISDIVE: true,
  },
  // inputs / outputs can have: (in addnt to name, description)
  TYPE: { // not the same as port-type, key or key(s) for compound types
    KEY: 231,
  },
  VALUE: { // data bytes currently occupying the output / input
    KEY: 232,
  },
  STATUS: {
    KEY: 233, // boolean open / closed, occupied / unoccupied, etc
  },
  // outputs have:
  NUMROUTES: {
    KEY: 234,
  },
  ROUTE: {
    KEY: 235, // within output,
  }
}

let TS = {}

let decoder = new TextDecoder()

TS.read = (type, buffer, start, keyless) => {
  if (!keyless) {
    throw new Error('need code here for key checking')
  }
  switch (type) {
    case 'uint8':
      return buffer[start]
    case 'uint16':
      // little endian: lsb is at the lowest address
      return (buffer[start] & 255) | (buffer[start + 1] << 8)
    case 'uint32':
      return (buffer[start] & 255) | (buffer[start + 1] << 8) | (buffer[start + 2] << 16) | (buffer[start + 3] << 24)
    case 'float32':
      return new Float32Array(buffer.slice(start, start + 4).buffer)[0]
    case 'boolean':
      if (buffer[start] > 0) {
        return true
      } else {
        return false
      }
      break;
    case 'string':
      let length = (buffer[start] & 255) | (buffer[start + 1] << 8) | (buffer[start + 2] << 16) | (buffer[start + 3] << 24)
      let pckSlice = buffer.slice(start + 4, start + 4 + length)
      return {
        value: decoder.decode(pckSlice),
          inc: length + 4
      }
      default:
        console.error('no code for this type read')
        return null
        break;
  }
}

let encoder = new TextEncoder()
let tempArr = {}
let tempBytes = {}

TS.write = (type, value, buffer, start, keyless) => {
  if (!keyless) {
    throw new Error('need code here for key checking')
  }
  switch (type) {
    case 'uint8':
      buffer[start] = value & 255
      return 1
    case 'uint16':
      // little endian: lsb is at the lowest address
      buffer[start] = value & 255
      buffer[start + 1] = (value >> 8) & 255
      return 2
    case 'uint32':
      buffer[start] = value & 255
      buffer[start + 1] = (value >> 8) & 255
      buffer[start + 2] = (value >> 16) & 255
      buffer[start + 3] = (value >> 24) & 255
      return 4
    case 'float32':
      tempArr = Float32Array.from([value])
      tempBytes = new Uint8Array(tempArr.buffer)
      buffer.set(tempBytes, start)
      return 4 
    case 'char':
      //      console.log('char', value.charCodeAt(0))
      buffer[start] = value.charCodeAt(0)
      return 1
    case 'string': // so, would be good to send long strings (i.e. dirty old gcodes), so 32b base
      let stringStream = encoder.encode(value)
      //console.log("WRITING STRING", value)
      buffer[start] = stringStream.length & 255
      buffer[start + 1] = (stringStream.length >> 8) & 255
      buffer[start + 2] = (stringStream.length >> 16) & 255
      buffer[start + 3] = (stringStream.length >> 24) & 255
      buffer.set(stringStream, start + 4)
      return 4 + stringStream.length
    case 'boolean':
      if (value) {
        buffer[start] = 1
      } else {
        buffer[start] = 0
      }
      return 1
    default:
      console.error('no code for this type write')
      return null
      break;
  }
}

// strings, eventually...
TS.writeAppErr = (msg) => {
  let reply = new Uint8Array(msg.length + 6)
  reply[0] = AK.ERR
  reply[1] = AK.E.MSG
  TS.write('string', msg, reply, 2, true)
  return reply
}

TS.logPacket = (buffer) => {
  // log a pretty buffer
  // buffers should all be Uint8Array views,
  let pert = []
  for (let i = 0; i < buffer.length; i++) {
    pert.push(buffer[i])
  }
  console.log(pert)
}

TS.portf = (num) => {
  return [PK.PORTF.KEY, num & 255, (num >> 8) & 255]
}

export {
  PK,
  DK,
  AK,
  EP,
  TS,
  TIMES
}
