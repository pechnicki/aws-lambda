exports.handler = async (event) => {
  let body;
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
  };

  try {
    const fetch = require("node-fetch");
    let eventList;
    if (!Array.isArray(event)) {
      eventList = [event];
    } else {
      eventList = event;
    }
    for (const message of eventList) {
      let data = JSON.stringify({
        text: message.text,
      });
      await fetch(message.webhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: data,
      })
        .then((response) => {
          statusCode = response.status;
        })
        .catch((err) => {
          console.error(err);
          statusCode = 400;
        });
    }
  } catch (err) {
    statusCode = 400;
  }

  return {
    statusCode,
    body,
    headers,
  };
};
