const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

// middleware
// app.use(cors());
app.use(express.json());
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z3gfp8c.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const db = client.db("PropertyPros");

    const featuredCollection = db.collection("Advertisement");
    const usersCollection = db.collection("Users");
    const wishlistCollection = db.collection("Wishlist");
    //Auth Related API
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      console.log(token);
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    app.get("/user/:email", async (req, res) => {
      const { email } = req.params;
      try {
        const user = await usersCollection.findOne({ email });
        res.send(user);
      } catch (error) {
        res.status(500).json({ message: "Failed to Find Profile", error });
      }
    });
    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
        console.log("Logout successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });
    // save user data in DB

    app.put("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      // check if user already exists in db
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        if (user.status === "Requested") {
          // if existing user try to change his role
          const result = await usersCollection.updateOne(query, {
            $set: { status: user?.status },
          });
          return res.send(result);
        } else {
          // if existing user login again
          return res.send(isExist);
        }
      }

      // save user for the first time
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // get all users data from db

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Main Data Part
    app.get("/Advertisement", async (req, res) => {
      const cursor = featuredCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/Advertisement/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await featuredCollection.findOne(query);
      res.send(result);
    });
    // Add to wishlist API
    app.post("/wishlist", async (req, res) => {
      const wishlistItem = req.body;
      try {
        const result = await wishlistCollection.insertOne(wishlistItem);
        res.status(200).json({ message: "Property added to wishlist", result });
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to add property to wishlist", error });
      }
    });
    // Remove from wishlist API
    app.delete("/wishlist/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await wishlistCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res
          .status(200)
          .json({ message: "Property removed from wishlist", result });
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to remove property from wishlist", error });
      }
    });

    // Fetch wishlist items for a user API
    app.get("/wishlist", async (req, res) => {
      const user = req.query.user; // Assuming the user ID is passed as a query parameter
      try {
        const result = await wishlistCollection.find({ user }).toArray();
        res.status(200).json(result);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to fetch wishlist items", error });
      }
    });

    //Agent Api's

    app.post("/api/properties", async (req, res) => {
      const { title, location, imageUrl, agentName, agentEmail, priceRange } =
        req.body;

      try {
        await client.connect();
        const db = client.db("PropertyPros");
        const propertiesCollection = db.collection("Properties");

        const newProperty = {
          title,
          location,
          imageUrl,
          agentName,
          agentEmail,
          priceRange,
          createdAt: new Date(),
        };

        const result = await propertiesCollection.insertOne(newProperty);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Error saving property", error });
      } finally {
        await client.close();
      }
    });

    app.get("/api/properties", async (req, res) => {
      const { agentEmail } = req.query;

      try {
        await client.connect();
        const db = client.db("PropertyPros");
        const propertiesCollection = db.collection("Properties");

        const properties = await propertiesCollection
          .find({ agentEmail })
          .toArray();
        res.send(properties);
      } catch (error) {
        res.status(500).send({ message: "Error fetching properties", error });
      } finally {
        await client.close();
      }
    });

    app.delete("/api/properties/:id", async (req, res) => {
      const { id } = req.params;

      try {
        await client.connect();
        const db = client.db("PropertyPros");
        const propertiesCollection = db.collection("Properties");

        const result = await propertiesCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error deleting property", error });
      } finally {
        await client.close();
      }
    });

    app.put("/api/properties/:id", async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;

      try {
        await client.connect();
        const db = client.db("PropertyPros");
        const propertiesCollection = db.collection("Properties");

        const result = await propertiesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error updating property", error });
      } finally {
        await client.close();
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("PropertyPros");
});

app.listen(port, () => {
  console.log(`PropertyPros is sitting on port ${port}`);
});
