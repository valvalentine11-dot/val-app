const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    bio: { type: String, default: '', maxlength: 280 },
    followers_count: { type: Number, default: 0 },
    following_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    first_name: this.first_name,
    last_name: this.last_name,
    username: this.username,
    email: this.email,
    bio: this.bio,
    followers_count: this.followers_count,
    following_count: this.following_count,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
