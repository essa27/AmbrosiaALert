const { v4: uuidv4 } = require("uuid");
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const http = require("http").createServer(app);
const socketIO = require("socket.io");
const { ServiceBusClient } = require("@azure/service-bus");
const cityCoordinates = require("./cityCoordinates.json");
const { startReceiver } = require("./receive");
const { startWebSocketServer } = require("./websocketserver");
const port = 3000;

app.use(express.static(path.join(__dirname, "public")));

const azureStorage = require("azure-storage");
const connectionString =
  "DefaultEndpointsProtocol=https;AccountName=ambrosiaalertstorage;AccountKey=rwWTRwFJgtuSVOJikQMJUfyIFFKL172jcVYDS99AIHcO3KIFxNYaPKUAfCUqJqUfnNMwR+neA58a+ASt720Rzw==;EndpointSuffix=core.windows.net";
const connectionString2 =
  "Endpoint=sb://alertsbus.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=m1+yr5uKKBkZTx0KKwRD+c9rP85G7LnrQ+ASbPHCD6A=";
// name of the queue
const queueName = "messages";
const tableService = azureStorage.createTableService(connectionString);
const tableName = "ambrosiatable";
const tableName2 = "users";

// Define a single route for the root path
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/index.html"));
});

// Middleware to parse JSON
app.use(bodyParser.json());

// Handle POST request for form data
app.post("/api/postData", (req, res) => {
  const { text, date, area, latitude, longitude } = req.body;

  // Generate PartitionKey and RowKey (you can adjust the logic based on your requirements)
  const partitionKey = uuidv4(); // Set your desired value
  // Generează un timestamp convertit în șir de caractere pentru RowKey
  const rowKey = Date.now().toString();

  const entity = {
    PartitionKey: { _: partitionKey },
    RowKey: { _: area },
    text: { _: text },
    longitude: { _: longitude },
    latitude: { _: latitude },
  };

  // Insert the entity into Azure Table Storage
  tableService.insertEntity(tableName, entity, (error, result, response) => {
    if (error) {
      console.error("Error inserting into Azure Table Storage:", error);
      res
        .status(500)
        .json({ error: "Error inserting into Azure Table Storage" });
    } else {
      console.log("Inserted successfully into Azure Table Storage");
      res.json({ success: true });
    }
  });
});

app.use(express.json()); // Add this line to parse JSON request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.post("/api/saveUserData", (req, res) => {
  const { name, email, longitude, latitude } = req.body;
  const partitionKey = uuidv4();
  // Generate a timestamp converted to a string for RowKey
  const rowKey = Date.now().toString();

  const entity = {
    PartitionKey: { _: partitionKey },
    RowKey: { _: name },
    Email: { _: email },
    Longitude: { _: longitude },
    Latitude: { _: latitude },
  };

  // Insert the entity into Azure Table Storage
  tableService.insertEntity(tableName2, entity, (error, result, response) => {
    if (error) {
      console.error("Error inserting into Azure Table Storage:", error);
      res
        .status(500)
        .json({ error: "Error inserting into Azure Table Storage" });
    } else {
      console.log("Inserted successfully into Azure Table Storage");
      res.json({ success: true });
    }
  });
});

app.get("/api/getFacts", (req, res) => {
  const query = new azureStorage.TableQuery().select([
    "text",
    "Timestamp",
    "area",
    "longitude",
    "latitude",
  ]);

  // Execute the query to retrieve specific columns
  tableService.queryEntities(
    tableName,
    query,
    null,
    (err, result, response) => {
      if (err) {
        res.status(500).json({ query: query, error: err.message });
        return;
      }

      // Extract the entries from the result
      const entries = result.entries;

      // Log the entries in the console
      //console.log("Entries from Azure Table Storage:", entries);

      // Return the response
      res.json(entries);
    }
  );
});

// Ruta pentru obținerea coordonatelor
app.get("/api/getCoordinates", (req, res) => {
  const query = new azureStorage.TableQuery().select(["longitude", "latitude"]);

  // Execute the query to retrieve specific columns
  tableService.queryEntities(
    tableName,
    query,
    null,
    (err, result, response) => {
      if (err) {
        console.error(
          "Error fetching coordinates from Azure Table Storage: ",
          err
        );
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      // Extract the entries from the result
      const entries = result.entries;

      // Extract long and lat from the entries
      const coordinates = entries.map((entry) => ({
        longitude: entry.longitude["_"],
        latitude: entry.latitude["_"],
      }));

      // Log the coordinates to console
      console.log("Coordonatele din Azure sunt:", coordinates);

      // Return the response
      res.json({ coordinates });
    }
  );
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Definiți o rută care să înceapă recepția mesajelor
app.get("/api/startReceiver", async (req, res) => {
  try {
    const messages = []; // Crează un array pentru a stoca mesajele
    // Apelați funcția care începe recepția mesajelor
    // create a Service Bus client using the connection string to the Service Bus namespace
    const sbClient = new ServiceBusClient(connectionString2);

    // createReceiver() can also be used to create a receiver for a subscription.
    const receiver = sbClient.createReceiver(queueName, {
      receiveMode: "receiveAndDelete", // Setarea modului pentru a citi și șterge mesajele
      autoCompleteMessages: false, // Dezactivați completarea automată a mesajelor
    });

    // function to handle messages
    const myMessageHandler = async (messageReceived) => {
      const messageBody = messageReceived.body.toString("utf-8");
      console.log(`Received message: ${messageReceived.body}`);
      messages.push(messageBody);
    };

    // function to handle any errors
    const myErrorHandler = async (error) => {
      console.log(error);
    };

    // subscribe and specify the message and error handlers
    receiver.subscribe({
      processMessage: myMessageHandler,
      processError: myErrorHandler,
    });

    // Waiting long enough before closing the sender to send messages
    await delay(20000);

    await receiver.close();
    await sbClient.close();
    // Returnați un răspuns către frontend (poate fi un JSON cu un mesaj de succes)
    res.json({ messages });
  } catch (error) {
    console.error("Error starting receiver:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
