import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: { type: Number, unique: true },
  balance: { type: Number, default: 0 },
  referral: { type: Number, default: null },
  orders: { type: Array, default: [] },
  deposits: { type: Array, default: [] }
});

export default mongoose.model("User", userSchema);
