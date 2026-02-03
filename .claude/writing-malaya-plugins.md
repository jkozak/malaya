# Writing Malaya Plugins

This document describes how to author plugins for the Malaya fact-based runtime.

## Entry Point

Plugins export an `init` function that receives the `malaya` object:

```javascript
exports.init = malaya => {
    const plugin = malaya.plugin;

    plugin.add("myPluginName", class extends plugin.Plugin {
        // Plugin implementation
    });
};
```

## Plugin Class Structure

Extend `malaya.plugin.Plugin` and implement lifecycle methods:

```javascript
class extends plugin.Plugin {
    constructor(opts = {}) {
        super();
        // Store configuration, initialize state
        this.opts = opts;
    }

    async start(cb) {
        super.start(cb);
        // Connect to external resources
        // Call cb(error) on failure
    }

    async ready() {
        if (this.disable) return;
        // Plugin is fully started
        // Emit initial facts, register event handlers
    }

    stop(cb) {
        // Clean up resources
        // Call cb() when done, cb(error) on failure
    }

    out(js, name, addr) {
        // Handle commands from the store
        // js is the fact array, e.g. ['operation', {args}]
    }
}
```

## Communication

### Plugin → Store (Emitting Facts)

Use `this.update()` to emit facts to the Malaya store:

```javascript
this.update(["eventType", { key: "value", data: 123 }]);
```

Facts are arrays where the first element is the fact type (string) and the second is the payload (object).

### Store → Plugin (Receiving Commands)

The `out(js, name, addr)` method receives commands from store rules:

```javascript
out(js, name, addr) {
    const [operation, args] = js;

    switch (operation) {
        case "doSomething":
            this.handleDoSomething(args);
            break;
        default:
            throw new Error(`unknown operation: ${operation}`);
    }
}
```

- `js` - The fact array `[operation, args]`
- `name` - Plugin instance name
- `addr` - Address metadata

## Using Plugins in Malaya Stores

```javascript
module.exports.main = store {
    // Match facts from plugin (src:'pluginName')
    ['eventType', {data}, {src:'myPlugin'}] =>
        console.log(`Received: ${data}`);

    // Send commands to plugin (dst:'pluginName')
    ['trigger', {}] =>
        +['doSomething', {param: 'value'}, {dst:'myPlugin'}];
}
.plugin('myPluginName', {
    option1: 'value1',
    option2: 'value2'
});
```

## Error Handling Pattern

Emit errors as facts for store-side handling:

```javascript
out(js, name, addr) {
    const [op, args] = js;

    this.handleOperation(args).catch(err => {
        this.update(["error", {
            requestId: args.requestId,  // Echo for correlation
            op,
            message: err.message,
        }]);
    });
}
```

## Request/Response Correlation

For async operations, accept an optional `requestId` in commands and echo it in responses:

```javascript
// Command handler
async _read(args) {
    const result = await this.doRead(args);
    this.update(["readResult", {
        requestId: args.requestId,  // Echo back
        data: result,
    }]);
}
```

Store rules can then correlate:

```javascript
['readResult', {requestId, data}, {src:'myPlugin'}] =>
    console.log(`Request ${requestId} returned: ${data}`);
```

## Package Structure

```
malaya-plugin-example/
├── package.json
├── index.js          # Plugin entry point with exports.init
└── CLAUDE.md         # Optional documentation
```

### package.json

```json
{
  "name": "malaya-plugin-example",
  "version": "0.1.0",
  "main": "index.js",
  "dependencies": {
    "malaya": "git+https://git@github.com/jkozak/malaya.git"
  }
}
```

## Lifecycle Summary

1. **Constructor**: Called with options from `.plugin()` config
2. **start(cb)**: Initialize external connections; call `cb(err)` on failure
3. **ready()**: Emit initial state, register ongoing event handlers
4. **out()**: Called when store sends facts to this plugin
5. **stop(cb)**: Cleanup; call `cb()` when done

## Example: Zigbee Plugin Exchanges

### Device Pairing Flow

```
Store → Plugin:  ['permitJoin', {time: 254}, {dst:'zigbee'}]
Plugin → Store:  ['permitJoin', {permitted: true, time: 254}]

                 ... user puts device in pairing mode ...

Plugin → Store:  ['deviceJoined', {ieeeAddr: '0x00124b00abcd1234', type: 'Router'}]
Plugin → Store:  ['deviceInterview', {ieeeAddr: '0x00124b00abcd1234', status: 'started'}]
Plugin → Store:  ['deviceInterview', {ieeeAddr: '0x00124b00abcd1234', status: 'successful',
                                       modelID: 'lumi.sensor_motion', manufacturer: 'LUMI'}]

Store → Plugin:  ['permitJoin', {time: 0}, {dst:'zigbee'}]
Plugin → Store:  ['permitJoin', {permitted: false, time: 0}]
```

### Reading Attributes

```
Store → Plugin:  ['read', {ieeeAddr: '0x00124b00abcd1234',
                           cluster: 'msTemperatureMeasurement',
                           attributes: ['measuredValue'],
                           requestId: 'temp-001'}, {dst:'zigbee'}]

Plugin → Store:  ['readResult', {requestId: 'temp-001',
                                  ieeeAddr: '0x00124b00abcd1234',
                                  endpoint: 1,
                                  cluster: 'msTemperatureMeasurement',
                                  data: {measuredValue: 2350}}]
```

### Sending Commands (e.g., Turn On Light)

```
Store → Plugin:  ['command', {ieeeAddr: '0x00124b00abcd1234',
                              cluster: 'genOnOff',
                              command: 'on',
                              payload: {}}, {dst:'zigbee'}]

                 ... no response fact unless error occurs ...
```

### Receiving Sensor Reports

```
                 ... device sends attribute report ...

Plugin → Store:  ['message', {ieeeAddr: '0x00124b00abcd1234',
                               endpoint: 1,
                               cluster: 'msTemperatureMeasurement',
                               type: 'attributeReport',
                               data: {measuredValue: 2350},
                               linkquality: 85}]

Plugin → Store:  ['attribute', {ieeeAddr: '0x00124b00abcd1234',
                                 endpoint: 1,
                                 cluster: 'msTemperatureMeasurement',
                                 attribute: 'measuredValue',
                                 value: 2350}]
```

### Writing Attributes

```
Store → Plugin:  ['write', {ieeeAddr: '0x00124b00abcd1234',
                            cluster: 'genOnOff',
                            attributes: {onTime: 100},
                            requestId: 'write-001'}, {dst:'zigbee'}]

                 ... no response fact unless error occurs ...
```

### Error Handling

```
Store → Plugin:  ['read', {ieeeAddr: '0x00124b00deadbeef',
                           cluster: 'genOnOff',
                           attributes: ['onOff'],
                           requestId: 'read-002'}, {dst:'zigbee'}]

Plugin → Store:  ['error', {requestId: 'read-002',
                            op: 'read',
                            ieeeAddr: '0x00124b00deadbeef',
                            message: 'device not found: 0x00124b00deadbeef'}]
```

### Store Rules Example

```javascript
module.exports.main = store {
    // Start pairing when requested
    ['startPairing', {}] =>
        +['permitJoin', {time: 254}, {dst:'zigbee'}];

    // Log new devices
    ['deviceJoined', {ieeeAddr, type}, {src:'zigbee'}] =>
        console.log(`New ${type}: ${ieeeAddr}`);

    // Handle temperature reports (value is in centidegrees)
    ['attribute', {ieeeAddr, cluster:'msTemperatureMeasurement',
                   attribute:'measuredValue', value}, {src:'zigbee'}] =>
        console.log(`${ieeeAddr} temperature: ${value/100}°C`);

    // Turn on light by friendly name
    ['turnOn', {device}] =>
        +['command', {ieeeAddr: devices[device],
                      cluster: 'genOnOff',
                      command: 'on',
                      payload: {}}, {dst:'zigbee'}];

    // Handle errors
    ['error', {requestId, op, message}, {src:'zigbee'}] =>
        console.error(`Zigbee ${op} failed: ${message}`);
}
.plugin('zigbee', {
    serialPort: '/dev/ttyUSB0',
    adapter: 'zstack',
    channel: 15
});
```

## Tips

- Check `this.disable` in `ready()` before doing work
- Use `super.start(cb)` at the beginning of `start()`
- Async errors in `out()` should be caught and emitted as error facts
- Keep fact payloads as plain objects for serialization
