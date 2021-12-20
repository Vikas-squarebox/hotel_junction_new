const mongoose = require("mongoose");
const cities = require("./cities");
const { places, descriptors } = require("./seedHelpers");
const Hotel = require("../models/hotel");

mongoose.connect("mongodb://localhost:27017/hotels", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Database connected");
});

const sample = (array) => array[Math.floor(Math.random() * array.length)];

const seedDB = async () => {
  await Hotel.deleteMany({});
  for (let i = 0; i < 10; i++) {
    const randomCity = Math.floor(Math.random() * 1000);
    const hotel = new Hotel({
      author: "61bd938039305ce657e20713",
      location: `${cities[randomCity].city}, ${cities[randomCity].state}`,
      title: `${sample(descriptors)} ${sample(places)}`,
      image: "https://source.unsplash.com/collection/483251",
      description:
        "Lorem ipsum dolor, sit amet consectetur adipisicing elit. Veritatis, ipsam quas aperiam aliquid dolor exercitationem, sed harum vero facilis quae magnam quidem tenetur aspernatur! Quaerat laudantium autem nostrum. Consectetur, officia!",
      price: `${Math.floor(Math.random() * 100)}`,
    });
    await hotel.save();
  }
};

seedDB().then(() => {
  mongoose.connection.close();
});
