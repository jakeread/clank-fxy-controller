/*
modules.js

osap tool client side

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

// no types or anything yet, 
// really, should probably do that with TS 
function Output(){
    this.data = null 
    this.connections = []
    
    this.send = async (data) => {
        if(this.io()){
            // could do: if already sending (as is the case w/ .io() true)
            // just return the existing promise, yeah ? 
            throw new Error('output is occupied')
        } else {
            // de-reference data in, handle non-existent datas (tokens)
            if(data == null || data == undefined){
                this.data = null 
            } else {
                this.data = JSON.parse(JSON.stringify(data))
            }
            // wait for all inputs to handle it, 
            // TODO: should be able to serve all 'simultaneously' and then wait for all to resolve, 
            // via this method, one can delay, blocking others from being called 
            for(let ip of this.connections){
                try {
                    await ip.receive(this.data)
                } catch(err) {
                    console.error(err)
                }
            }
            // hang here for one loop of the JS event cycle: puts some breath into the system
            // q about this: if everything is direct-call
            // i.e. none of the listeners are natively async, 
            // this will run loops to completion: so without the hang / timeout, 
            // things will lock up. maybe that's ok ? 
            //await new Promise((resolve) => {setTimeout(resolve, 0)})
            // now we r done & clear 
            this.data = null 
        }
    }

    // here's actually where this should be different. 
    // this should be a list of routes. do I want to do that now, already? 
    // so TODO: don't attach inputs, add new routes to a list, 
    // execute each route *and then* return the promises. 
    this.attach = (input) => {
        this.connections.push(input)
    }

    this.detatch = (input) => {
        console.error('WRITEME')
    }

    this.io = () => {
        if(this.data){
            return true 
        } else {
            return false 
        }
    }
}

function Input(){
    // manage listeners 
    this.listeners = []
    this.addListener = (func) => {
        // these *should* return promises, or async functions,
        // but any immediate-calls will just be served regardless 
        this.listeners.push(func)
        /*
        // check that this is an async func 
        // promises *would* do the same, but ... let's just assert 
        // all are async, ok? cleaner - easy to implement either way 
        if(func.constructor.name === 'AsyncFunction'){
            this.listeners.push(func)
        } else {
            console.error('Input Listeners must be Async Functions')
            console.error("couldn't attach", func)
        }
        */
    }
    this.removeListener = (func) => {
        console.error('WRITEME')
    }
    // listeners must all return promises, 
    this.receive = async (data) => {
        for(let listener of this.listeners){
            //console.log(listener)
            await listener(data)
        }
    }
}

export { Output, Input }