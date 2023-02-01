var AWS = require("aws-sdk");
module.exports = class InvokeLambda {
  constructor(region = "sa-east-1") {
    if (InvokeLambda._instance) {
      return InvokeLambda._instance;
    }
    InvokeLambda._instance = this;
    AWS.config.region = region;
    this.lambda = new AWS.Lambda();
  }

  async invoke(payload, functionName) {
    const params = {
      FunctionName: functionName,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: JSON.stringify(payload),
    };
    const result = await this.lambda
      .invoke(params)
      .promise()
      .then((res) => JSON.parse(res.Payload));
    return result;
  }
};
