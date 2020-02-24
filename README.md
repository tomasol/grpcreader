# Running javascript plugins for devmand

Install dependencies into node_modules:
```
npm install
```
then run the Ubiquiti plugin:
```
node plugin-ubnt-ifc-config-reader.js
```

or linux plugin:
```
node plugin-linux-ifc-reader.js
```

Either of those will start a gRPC server on 0.0.0.0:50051 .

Note that the plugins only talk with devmand, there is no direct connection to
the managed device.

# Devmand

## Configuration
Devmand needs to be configured as well, example configuration is stored in devmand's `doc/config-sample` folder.
### plugin.json
```json
{
  "grpcPlugins":[
    {"id":"nodejsapp", "endpoint":"localhost:50051"}
  ]
}
```
This file contains list of remote plugins - their endpoints and identifiers. Devmand
will fail to start if any of those endpoints is not available.

### dev_conf.yaml
`Plugin.json` needs to be referenced from `dev_conf.yaml` as shown.
```yml
pluginConfig: /root/plugin.json
...
```

For linux example use following contents:
```yml
devices:
 - id: linux
   ip: 172.8.0.85
   readonly: false
   platform: StructuredUbntCli
   yangConfig: /root/localhost.json
   type: Device
   poll:
     seconds: 10
   channels:
     cliChannel:
       port: 22
       username: root
       password: root
       flavour: default
       stateCommand: echo 1
pluginConfig: /root/plugin.json
```

## Tweaks
- Increase polling frequency in devmand:
 https://github.com/marosmars/magma/commit/345615c9b26179a1d51ddebef277cdf6cce9630d#diff-263c303f3678cbe6f4be13e61087fa79
- Dump the state into `device_state.json` file:
https://github.com/marosmars/magma/commit/345615c9b26179a1d51ddebef277cdf6cce9630d#diff-cc71baeacaa77a39ac384cc38786fb10
- Run nodejs using `nodemon` for autorefresh functionality
- It is safe to disable all other Platforms and starting of magma as this might cause permission and other errors.

All tweaks are available here: `https://github.com/tomasol/magma/commits/grpc-plugins-tweaks

# Quick start guide for running the demo with linux plugin
- Start devmand container e.g. using `docker/scripts/start_devmand_img.sh` found in devmand repo
- Build devmand with the tweaks so that datastore is stored in `device_state.json`.
- Copy `dev_conf.yaml` (the linux version mentioned above), `localhost.json`, `plugin.json`
from devmand's `doc/config-sample` to `/root/` of devmand container.
- Start `plugin-linux-ifc-reader.js`. The endpoint must be accessible from the container, e.g.
using `ssh -R 50051:127.0.0.1:50051 root@container_ip`.
- Start devmand. NodeJS should start logging registration request immediately.
- First pass of device polling should be done after a couple of seconds and the `device_state.json` should contain:
```sh
$ docker exec 85 cat /cache/devmand/build/device_state.json
```
```json
{
  "openconfig-interfaces:interfaces": {
    "interface": [
      {
        "subinterfaces": {
          "subinterface": [
            {
              "config": {
                "index": 0
              },
              "index": "0"
            }
          ]
        },
        "state": {
          "name": "lo"
        },
        "config": {
          "name": "lo",
          "enabled": true,
          "mtu": 65535
        },
        "name": "lo"
      },
      {
        "subinterfaces": {
          "subinterface": [
            {
              "config": {
                "index": 0
              },
              "index": "0"
            }
          ]
        },
        "state": {
          "name": "eth0"
        },
        "config": {
          "name": "eth0",
          "mtu": 1500,
          "enabled": true
        },
        "name": "eth0"
      }
    ]
  },
  "openconfig-network-instance:network-instances": {
    "network-instance": [
      {
        "vlans": {
          "vlan": [
            {
              "state": {
                "vlan-id": 1,
                "status": "ACTIVE"
              },
              "config": {
                "status": "ACTIVE",
                "vlan-id": 1
              },
              "vlan-id": "1"
            }
          ]
        },
        "config": {
          "type": "openconfig-network-instance-types:DEFAULT_INSTANCE",
          "name": "default"
        },
        "name": "default"
      }
    ]
  },
  "fbc-symphony-device:system": {
    "status": "UP"
  }
}
```
