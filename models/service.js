import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema({
  name: String,
  apiLink: String,
  pricePer1k: Number,
});

export default mongoose.model("Service", serviceSchema);
