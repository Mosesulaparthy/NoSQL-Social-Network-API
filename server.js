// Import necessary modules
const express = require('express');
const mongoose = require('mongoose');

// Create Express app
const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/myapp', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Define schemas
const reactionSchema = new mongoose.Schema({
  reactionBody: { type: String, required: true, maxlength: 280 },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, get: createdAt => createdAt.toLocaleString() }
});


const thoughtSchema = new mongoose.Schema({
    thoughtText: { type: String, required: true, minlength: 1, maxlength: 280 , index: true},
    createdAt: { type: Date, default: Date.now, get: createdAt => createdAt.toLocaleString() , index: true},
    username: { type: String, required: true, index: true }, // Add index property here
    reactions: [reactionSchema]
  });

thoughtSchema.virtual('reactionCount').get(function () {
  return this.reactions.length;
});

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, trim: true },
  email: { type: String, unique: true, required: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  thoughts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thought' }],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

userSchema.virtual('friendCount').get(function () {
  return this.friends.length;
});

// Create models
const User = mongoose.model('User', userSchema);
const Thought = mongoose.model('Thought', thoughtSchema);

// API Routes
// Users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().populate('thoughts').populate('friends');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('thoughts').populate('friends');
    if (user == null) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



app.post('/api/users', async (req, res) => {
    const { username, email } = req.body;
  
    try {
      const user = new User({ username, email });
      const newUser = await user.save();
      res.status(201).json(newUser);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
// Update user
app.put('/api/users/:id', async (req, res) => {
    try {
      const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete user
  app.delete('/api/users/:id', async (req, res) => {
    try {
      const deletedUser = await User.findByIdAndDelete(req.params.id);
      if (!deletedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      // Remove associated thoughts
      await Thought.deleteMany({ username: deletedUser.username });
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get all thoughts
  app.get('/api/thoughts', async (req, res) => {
    try {
      const thoughts = await Thought.find();
      res.json(thoughts);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get single thought by id
  app.get('/api/thoughts/:id', async (req, res) => {
    try {
      const thought = await Thought.findById(req.params.id);
      if (!thought) {
        return res.status(404).json({ message: 'Thought not found' });
      }
      res.json(thought);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create new thought
  app.post('/api/thoughts', async (req, res) => {
    try {
      const thought = new Thought({
        thoughtText: req.body.thoughtText,
        username: req.body.username
      });
      const newThought = await thought.save();
      // Push thought's _id to associated user's thoughts array
      const user = await User.findOneAndUpdate({ username: req.body.username }, { $push: { thoughts: newThought._id } }, { new: true });
      res.status(201).json(newThought);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  
  // Update thought
  app.put('/api/thoughts/:id', async (req, res) => {
    try {
      const updatedThought = await Thought.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updatedThought) {
        return res.status(404).json({ message: 'Thought not found' });
      }
      res.json(updatedThought);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete thought
  app.delete('/api/thoughts/:id', async (req, res) => {
    try {
      const deletedThought = await Thought.findByIdAndDelete(req.params.id);
      if (!deletedThought) {
        return res.status(404).json({ message: 'Thought not found' });
      }
      res.json({ message: 'Thought deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create reaction
  app.post('/api/thoughts/:thoughtId/reactions', async (req, res) => {
    try {
      const thought = await Thought.findById(req.params.thoughtId);
      if (!thought) {
        return res.status(404).json({ message: 'Thought not found' });
      }
      thought.reactions.push({
        reactionBody: req.body.reactionBody,
        username: req.body.username
      });
      const updatedThought = await thought.save();
      res.status(201).json(updatedThought);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete reaction
  app.delete('/api/thoughts/:thoughtId/reactions/:reactionId', async (req, res) => {
    try {
        const thought = await Thought.findById(req.params.thoughtId);
        if (!thought) {
            return res.status(404).json({ message: 'Thought not found' });
        }

        const reactionToRemove = thought.reactions.find(reaction => reaction._id.toString() === req.params.reactionId);
        if (!reactionToRemove) {
            return res.status(404).json({ message: 'Reaction not found' });
        }

        console.log('Existing reactions:', thought.reactions);

        thought.reactions = thought.reactions.filter(reaction => reaction._id.toString() !== req.params.reactionId);

        console.log('Filtered reactions:', thought.reactions);

        await thought.save(); // Save the updated thought after filtering

        res.json({ message: 'Reaction deleted successfully' });
    } catch (error) {
        console.error(error); // Log any errors to console for debugging
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Add or remove friends for a user
app.post('/api/users/:userId/friends/:friendId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    const friend = await User.findById(req.params.friendId);
    
    if (!user || !friend) {
      return res.status(404).json({ message: 'User or friend not found' });
    }

    // Add friend to user's friend list
    user.friends.push(friend._id);
    await user.save();

    // Add user to friend's friend list (optional, depending on your application logic)
    // friend.friends.push(user._id);
    // await friend.save();

    res.status(200).json({ message: 'Friend added successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/users/:userId/friends/:friendId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    const friend = await User.findById(req.params.friendId);
    
    if (!user || !friend) {
      return res.status(404).json({ message: 'User or friend not found' });
    }

    // Remove friend from user's friend list
    user.friends.pull(friend._id);
    await user.save();

    // Remove user from friend's friend list (optional, depending on your application logic)
    // friend.friends.pull(user._id);
    // await friend.save();

    res.status(200).json({ message: 'Friend removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
