import type * as sdk from './openapi.js';

export * as sdk from './openapi.js';
export { getOpenApiSpec, openApiSpec } from './spec.js';

export type AkamaiSolveRequest = Akamai['Request']['solve'];
export type AkamaiSolveResponse = Akamai['Response']['solve'];
export type DatadomeSolveRequest = Datadome['Request']['solve'];

export type DatadomeSolveResponse = Datadome['Response']['solve'];
export type Stats = Health['Response']['stats'];

type Akamai = {
  Request: {
    solve: sdk.operations['postAkamaiSolve']['requestBody']['content']['application/json'];
  };
  Response: {
    solve: sdk.operations['postAkamaiSolve']['responses']['200']['content']['application/json'];
  };
};

type Datadome = {
  Request: {
    solve: sdk.operations['postDdSolve']['requestBody']['content']['application/json'];
  };
  Response: {
    solve: sdk.operations['postDdSolve']['responses']['200']['content']['application/json'];
  };
};

type Health = {
  Response: {
    stats: sdk.operations['getStats']['responses']['200']['content']['application/json'];
  };
};
