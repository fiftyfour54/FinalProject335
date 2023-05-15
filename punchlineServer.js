const fs = require("fs");
const path = require("path");

const express = require("express");
const app = express();
const portNumber = 5000;

const bodyParser = require("body-parser");

require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const databaseAndCollection = {
    db: process.env.MONGO_DB_NAME,
    collection: process.env.MONGO_COLLECTION,
};

app.use(bodyParser.urlencoded({ extended: false }));

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
app.use("/images", express.static("images"));

const { MongoClient, ServerApiVersion } = require("mongodb");
const e = require("express");
process.stdin.setEncoding("utf8");

class Client {
    #uri;
    #client;
    constructor() {
        this.#uri = `mongodb+srv://${userName}:${password}@cluster0.v2kuma1.mongodb.net/?retryWrites=true&w=majority`;
        this.#client = new MongoClient(this.#uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverApi: ServerApiVersion.v1,
        });
    }
    async addPunchline(id, punchline, name) {
        var result;
        try {
            await this.#client.connect();

            let joke = { id: id, name: name, punchline: punchline };
            result = await this.#client
                .db(databaseAndCollection.db)
                .collection(databaseAndCollection.collection)
                .insertOne(joke);
        } catch (e) {
            console.error(e);
        } finally {
            await this.#client.close();
        }
        return result;
    }
    async lookupId(id) {
        try {
            await this.#client.connect();
            let filter = { id: id };
            const cursor = await this.#client
                .db(databaseAndCollection.db)
                .collection(databaseAndCollection.collection)
                .find(filter);
            const result = await cursor.toArray();

            return result;
        } catch (e) {
            console.error(e);
        } finally {
            await this.#client.close();
        }
    }

    async lookupAuthor(name) {
        try {
            await this.#client.connect();
            let filter = { name: name };
            const cursor = await this.#client
                .db(databaseAndCollection.db)
                .collection(databaseAndCollection.collection)
                .find(filter);
            const result = await cursor.toArray();
            return result;
        } catch (e) {
            console.error(e);
        } finally {
            await this.#client.close();
        }
    }
    async clear() {
        try {
            await this.#client.connect();
            const cursor = this.#client
                .db(databaseAndCollection.db)
                .collection(databaseAndCollection.collection)
                .find({});

            const result = await cursor.toArray();

            await this.#client
                .db(databaseAndCollection.db)
                .collection(databaseAndCollection.collection)
                .deleteMany({});

            return result.length;
        } catch (e) {
            console.error(e);
        } finally {
            await this.#client.close();
        }
    }
}
var client = new Client();

async function getJoke(random = true, _id = "") {
    let good = false;
    let sections = [];
    let jokeId = "";
    let jokeStatus = "";
    while (!good) {
        let jokeUrl = random
            ? `https://icanhazdadjoke.com/`
            : `https://icanhazdadjoke.com/j/${_id}`;
        let jokeJson = await fetch(jokeUrl, {
            headers: {
                Accept: "application/json",
                "User-Agent": "CMSC 335 Project",
            },
        });
        const { id, joke, status } = await jokeJson.json();
        jokeStatus = status;
        if (status != "404") {
            sections = joke.match(re);
            jokeId = id;
            //console.log(id.toString())
            if (sections.length > 1) {
                //console.log("YES! " + sections.toString());
                if(sections[sections.length - 1].length > 2){
                good = true;
            }
            } else {
                //console.log("NO! " + joke.toString());
            }
        } else {
            good = true; //Lie but for good reason
        }
    }
    //console.log(sections.toString())
    return { id: jokeId, sections: sections, status: jokeStatus };
}

function getSetup(sections) {
    return sections.slice(0, Math.max(sections.length - 1, 1)).join("");
}
function getPunchline(sections) {
    return sections[sections.length - 1];
}

const re = /(?:(?:[^.!?:,]|\-\-)+(?:[.!?:\,]|$|\-\-)+\"*\s*)/g;

app.get("/", async (request, response) => {
    const { id, sections, status } = await getJoke();
    //   console.log(sections.toString());
    //   console.log(id.toString());
    response.render("index", {
        joke: getSetup(sections),
        punch: getPunchline(sections),
        id: id,
    });
});
app.get("/submit/:jokeId", async (request, response) => {
    let { jokeId } = request.params;
    const { id, sections, status } = await getJoke(false, jokeId);
    if (status == "404") {
        response.render("notFound");
        return;
    }
    response.render("index", {
        joke: getSetup(sections),
        punch: getPunchline(sections),
        id: id,
    });
});
app.get("/search", async (request, response) => {
    response.render("search");
});

async function getPunchTable(jokeId, firstpunch = "") {
    lines = await client.lookupId(jokeId);
    //console.log(lines);
    //console.log(lines.length);
    out = `<ul class="list-group">`;
    if (firstpunch != "") {
        out += `<li class="list-group-item list-group-item-danger">
    <div class="d-flex w-100 justify-content-between">
    <h3 class="mb-1">${firstpunch}</h5>
    </div></li>`
    }
    if ((lines != null) && (lines.length > 0)) {
        for (const line of lines) {
            //console.log(line);
            const { _id, id, name, punchline } = line;
            out +=
                `<li class="list-group-item list-group-item-dark">
      <div class="d-flex w-100 justify-content-between">
      <h3 class="mb-1">${punchline}</h5>
      <small>${name}</small>
      </div></li>`;
        }
    }
    return out + "</ul>";
}

app.get("/joke/:jokeId", async (request, response) => {
    let { jokeId } = request.params;
    const { id, sections, status } = await getJoke(false, jokeId);
    if (status == "404") {
        response.render("notFound");
        return;
    }
    response.render("displayJoke", {
        head: jokeId,
        setup: getSetup(sections),
        content: await getPunchTable(jokeId, await getPunchline(sections)),
    });
});

app.post("/search", async (request, response) => {
    let { jokeSearch } = request.body;
    const { id, sections, status } = await getJoke(false, jokeSearch);
    if (status == "404") {
        response.render("notFound");
        return;
    }
    response.redirect(`/joke/${jokeSearch}`)
});

app.post("/joke/:jokeId", async (request, response) => {
    let { jokeId } = request.params;
    let { userPunchline, jokeAuthor } = request.body;
    const { id, sections, status } = await getJoke(false, jokeId);
    if (status == "404") {
        response.render("notFound");
        return;
    }
    await client.addPunchline(jokeId, userPunchline, jokeAuthor);
    response.redirect(`/joke/${jokeId}`)
});

app.listen(portNumber);

const prompt = "Stop to shutdown the server: ";

process.stdout.write(prompt);
process.stdin.on("readable", function () {
    let dataInput = process.stdin.read();
    if (dataInput !== null) {
        let command = dataInput.trim();
        if (command === "stop") {
            process.stdout.write("Shutting down the server");
            process.exit(0);
        } else {
            process.stdout.write(`Invalid command: ${command}\n`);
        }
        process.stdout.write(prompt);
        process.stdin.resume();
    }
});
