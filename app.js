const express = require("express");
const app = express();
const dotenv = require("dotenv");

const methodOverride = require("method-override");
const mongoose = require("mongoose");
const catchAsync = require("./utilities/catchAsync");
const ExError = require("./utilities/ExError");
const path = require("path");
const Joi = require("joi");
const Hotel = require("./models/hotel");
const ejsMate = require("ejs-mate");
const Review = require("./models/review");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user");
const { isLoggedIn } = require("./middleware");
const db_url = process.env.DB_URL;
//

mongoose.connect("mongodb://localhost:27017/hotels", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

//connect to mongoose
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

app.engine("ejs", ejsMate);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

const sessionConfig = {
  secret: "secret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: new Date(Date.now() + 3600000),
  },
};
app.use(session(sessionConfig));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

//authenticate is a function that passport provides (static method)
passport.use(new LocalStrategy(User.authenticate()));
//into the session
passport.serializeUser(User.serializeUser());
//how user get out of the session
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

app.get("/register", (req, res) => {
  res.render("users/register");
});

app.post(
  "/register",
  catchAsync(async (req, res, next) => {
    try {
      const { email, username, password } = req.body;
      const user = new User({ email, username });
      const registerUser = await User.register(user, password);
      req.login(registerUser, (err) => {
        if (err) return next(err);
        req.flash("success", "You are registered");
        res.redirect("/hotels");
      });
    } catch (err) {
      req.flash("error", err.message);
      res.redirect("/register");
    }
  })
);

app.get("/login", (req, res) => {
  res.render("users/login");
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureFlash: true,
    failureRedirect: "/login",
  }),
  (req, res) => {
    req.flash("success", "You are logged in");
    res.redirect("/hotels");
  }
);
app.get("/logout", (req, res) => {
  req.logout();
  req.flash("success", "You are logged out");
  res.redirect("/hotels");
});

const validateHotel = (req, res, next) => {
  const hotelSchema = Joi.object({
    hotel: Joi.object({
      title: Joi.string().required(),
      price: Joi.number().required().min(0),
      image: Joi.string().required(),
      location: Joi.string().required(),
      description: Joi.string().required(),
    }).required(),
  });

  const { error } = hotelSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((i) => i.message).join(", ");
    throw new ExError(result.error.details[0], 400);
  } else {
    next();
  }
};

const validateReview = (req, res, next) => {
  const reviewSchema = Joi.object({
    review: Joi.object({
      rating: Joi.number().required().min(1).max(5),
      body: Joi.string().required(),
    }).required(),
  });

  const { error } = reviewSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((i) => i.message).join(", ");
    throw new ExError(msg, 400);
  } else {
    next();
  }
};

//hoem route
app.get("/", (req, res) => {
  res.render("home");
});

//show one hotel
app.get(
  "/hotels",
  catchAsync(async (req, res) => {
    const hotels = await Hotel.find();
    res.render("hotels/index", { hotels });
  })
);

app.get("/hotels/new", isLoggedIn, (req, res) => {
  res.render("hotels/new");
});

//ading new hotel
app.post(
  "/hotels",
  isLoggedIn,
  validateHotel,
  catchAsync(async (req, res, next) => {
    const hotel = new Hotel(req.body.hotel);
    hotel.author = req.user._id;
    await hotel.save();
    req.flash("success", "New Hotel added successfully");
    res.redirect(`/hotels/${hotel._id}`);
  })
);

//it will show you the details of the hotel
app.get("/hotels/:id", async (req, res) => {
  const hotel = await Hotel.findById(req.params.id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("author");
  if (!hotel) {
    req.flash("error", "Hotel not found");
    res.redirect("/hotels");
  } else {
    res.render("hotels/show", { hotel });
  }
});

//fetch the hotel to be edited
app.get(
  "/hotels/:id/edit",
  isLoggedIn,
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const hotel = await Hotel.findById(id);
    if (!hotel) {
      req.flash("error", "Hotel not found");
      res.redirect("/hotels");
    }
    if (!currentUser.author.equals(req.user._id)) {
      req.flash("error", "You are not authorized to edit this hotel");
      res.redirect(`/hotels/${id}`);
    }
    res.render("hotels/edit", { hotel });
  })
);

//editing the hotel details
app.put(
  "/hotels/:id",
  isLoggedIn,
  validateHotel,
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const hotel = await Hotel.findById(id);
    if (!currentUser.author.equals(req.user._id)) {
      req.flash("error", "You are not authorized to edit this hotel");
      res.redirect(`/hotels/${id}`);
    }
    const myhotel = await Hotel.findByIdAndUpdate(id, { ...req.body.hotel });
    req.flash("success", "Hotel updated successfully");
    res.redirect(`/hotels/${hotel._id}`);
  })
);

//find the hotel using id and delete
app.delete("/hotels/:id", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  await Hotel.findByIdAndDelete(id);
  req.flash("success", "Hotel deleted successfully");
  res.redirect("/hotels");
});

app.post(
  "/hotels/:id/reviews",
  isLoggedIn,
  validateReview,
  catchAsync(async (req, res) => {
    const hotel = await Hotel.findById(req.params.id);
    const review = new Review(req.body.review);
    review.author = req.user._id;
    hotel.reviews.push(review);
    await review.save();
    await hotel.save();
    req.flash("success", "Review added successfully");
    res.redirect(`/hotels/${hotel._id}`);
  })
);

app.delete("/hotels/:id/reviews/:reviewId", isLoggedIn, async (req, res) => {
  const { id, reviewId } = req.params;
  const review = await Review.findById(reviewId);

  if (!review.author.equals(req.user._id)) {
    req.flash("error", "You are not authorized to delete this review");
    res.redirect(`/hotels/${id}`);
  }
  await Hotel.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
  req.flash("success", "Review deleted successfully");
  res.redirect(`/hotels/${id}`);
});

app.all("*", (req, res, next) => {
  next(new ExError("Page not Found", 404));
});

//Error handling
app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = "Something went wrong";
  res.status(statusCode).render("error", { err });
});

app.listen(3000, () => {
  console.log("listening on 3000");
});
