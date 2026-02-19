export class ConnectorBase {
  constructor(connectorName) {
    this.connectorName = connectorName;
  }

  // Each concrete connector returns candidates + checkpoint metadata.
  async collect() {
    throw new Error(`collect() not implemented for ${this.connectorName}`);
  }
}
