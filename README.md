Create a link to gRPC proto file named plugin.proto in current folder:
```
ln -s ${MAGMA_REPO}/devmand/gateway/src/devmand/channels/cli/plugin/proto/ReaderPlugin.proto
```
Install dependencies into node_modules:
```
npm install
```
then run
```
node grpcReader.js
```
This will start gRPC server on 0.0.0.0:50051

A dummy client is available, run it using
```
node grpcClient.js
```
