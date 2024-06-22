const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

// Middleware
app.use(express.json());
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://propertypros-c2123.web.app",
    "https://roaring-lamington-45d3b6.netlify.app",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z3gfp8c.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function connectToDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
}

connectToDB();

const db = client.db("PropertyPros");
const featuredCollection = db.collection("Advertisement");
const usersCollection = db.collection("Users");
const wishlistCollection = db.collection("Wishlist");
const propertiesCollection = db.collection("Properties");

app.post("/jwt", (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "365d",
  });
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

app.get("/logout", (req, res) => {
  res
    .clearCookie("token", {
      maxAge: 0,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    })
    .send({ success: true });
  console.log("Logout successful");
});

app.put("/user", async (req, res) => {
  const user = req.body;
  const query = { email: user?.email };
  const isExist = await usersCollection.findOne(query);
  if (isExist) {
    if (user.status === "None") {
      const result = await usersCollection.updateOne(query, {
        $set: { status: user?.status },
      });
      return res.send(result);
    } else {
      return res.send(isExist);
    }
  }

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
app.patch("/user/:email", async (req, res) => {
  try {
    const { status } = req.body;
    const { email } = req.params;
    const user = await usersCollection.findOneAndUpdate({ email }, { status });
    res.send(user);
  } catch (error) {
    res.status(500);
  }
});

app.get("/users", async (req, res) => {
  const result = await usersCollection.find().toArray();
  res.send(result);
});
app.put("/user/:email", async (req, res) => {
  const { email } = req.params;
  const { status } = req.body;

  try {
    const result = await usersCollection.updateOne(
      { email: email },
      { $set: { status: status } }
    );

    if (result.matchedCount > 0) {
      res.status(200).send({ message: "User status updated successfully" });
    } else {
      res.status(404).send({ message: "User not found" });
    }
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).send({ message: "Error updating user status", error });
  }
});

app.get("/Advertisement", async (req, res) => {
  const cursor = propertiesCollection.find();
  const result = await cursor.toArray();
  res.send(result);
});

app.get("/Advertisement/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await propertiesCollection.findOne(query);
  res.send(result);
});

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

app.delete("/wishlist/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await wishlistCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.status(200).json({ message: "Property removed from wishlist", result });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to remove property from wishlist", error });
  }
});

app.get("/wishlist", async (req, res) => {
  const user = req.query.user;
  try {
    const result = await wishlistCollection.find({ user }).toArray();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch wishlist items", error });
  }
});

app.post("/api/properties", async (req, res) => {
  const { title, location, imageUrl, agentName, agentEmail, priceRange } =
    req.body;

  const newProperty = {
    title,
    location,
    imageUrl,
    agentName,
    agentEmail,
    status: "pending",
    priceRange,
    createdAt: new Date(),
  };

  try {
    const result = await propertiesCollection.insertOne(newProperty);
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: "Error saving property", error });
  }
});

app.get("/api/properties", async (req, res) => {
  const { agentEmail } = req.query;

  try {
    const properties = await propertiesCollection
      .find({ agentEmail })
      .toArray();
    res.send(properties);
  } catch (error) {
    res.status(500).send({ message: "Error fetching properties", error });
  }
});

app.get("/api/properties/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const property = await propertiesCollection.findOne({
      _id: new ObjectId(id),
    });
    if (!property) {
      return res.status(404).send({ message: "Property not found" });
    }
    res.send(property);
  } catch (error) {
    res.status(500).send({ message: "Error fetching property", error });
  }
});

app.delete("/api/properties/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await propertiesCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Error deleting property", error });
  }
});

app.put("/api/properties/:id", async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const result = await propertiesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount > 0) {
      res.status(200).send({ message: "Property updated successfully" });
    } else {
      res.status(404).send({ message: "Property not found" });
    }
  } catch (error) {
    res.status(500).send({ message: "Error updating property", error });
  }
});

app.get("/", (req, res) => {
  res.send("PropertyPros");
});

app.listen(port, () => {
  console.log(`PropertyPros is sitting on port ${port}`);
});
