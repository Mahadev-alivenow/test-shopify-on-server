// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";
import mongoose from "mongoose";

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js

app.use("/api/*", shopify.validateAuthenticatedSession());
app.use("/userdata/*", authenticateUser);

app.use(express.json());

async function authenticateUser(req, res, next) {
  let shop = req.query.shop;
  let storeName = await shopify.config.sessionStorage.findSessionsByShop(shop);
  // let storeName = await shopify.shop
  console.log(storeName);
  console.log(shop);
  if (shop === storeName[0]?.shop) {
    next();
  } else {
    res.send("User not Autherised!.");
  }
}


//MONGO DB connection  local : "mongodb://localhost:27017/"
const url =
  "mongodb+srv://mahadev:ka039814@cluster0.tiauwuh.mongodb.net/auth-demo?retryWrites=true&w=majority";

let client;
try {
  console.log(url);
  client = await mongoose.connect(url);
  console.log("--- Connected to Mongoose Succesfully ---");
} catch (error) {
  console.log("-- Mangoose can't connect!!! ---");
}
let userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  useremail: {
    type: String,
    required: true,
    unique: true,
  },
});

let User = mongoose.model("shopdashboard", userSchema);

// app.post("/userdata/userinfo", async (req, res) => {
//   const userdata = req.body
// console.log(userdata)
//   res.status(200).json(userdata)
// })

app.post("/userdata/userinfo", async (req, res) => {
  let userdata = req.body;

  //multiple end-points get userinfo method get
  // res.status(200).send('Message sent Succefully!!!')

  //single user data method post
  console.log(userdata);
  // res.status(200).send(userdata)
  try {
    let createUser = await User.create({
      username: userdata.username,
      useremail: userdata.useremail,
    });

    // let createUserMySQL = await connection.query(
    //   `INSERT INTO users (name,email) VALUES ('${userdata[0]}',${userdata[1]}')`,
    //   function(error,results,fields){
    //     if(error) throw error
    //   }
    // );
    // await connection.query(
    //   "INSERT INTO users (name,email) VALUES (?,?)",
    //   [userdata.username, userdata.useremail],
    //   (error, results) => {
    //     if (error) {
    //       console.error(error);
    //     } else {
    //       console.log(" in SQL -- New user inserted successfully!");
    //     }
    //   }
    // );

    console.log("--- User Created Succesfully MONGO alivenow --- ");
    res.status(200).json("--- User Created Succesfully --- ");
    return true;
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json("- User Already exits -");
    } else {
      console.log(error);
    }
  }
});

app.get("/api/products/count", async (_req, res) => {
  const countData = await shopify.api.rest.Product.count({
    session: res.locals.shopify.session,
  });
  res.status(200).send(countData);
});

app.get("/api/products/create", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    await productCreator(res.locals.shopify.session);
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }
  res.status(status).send({ success: status === 200, error });
});

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(join(STATIC_PATH, "index.html")));
});

app.listen(PORT);
