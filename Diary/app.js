// Import dependencies
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const app = express();
const PORT = 3000;

// Connect to MongoDB
mongoose.connect('mongodb+srv://johnllentv:johnllentv@cluster0.pgaelxg.mongodb.net/Diaries', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Define Mongoose Schemas
const diarySchema = new mongoose.Schema({
    title: String,
    content: String,
    date: { type: Date, default: Date.now },
});
const Diary = mongoose.model('Diary', diarySchema);

// Separate collection for scheduled posts
const scheduledDiarySchema = new mongoose.Schema({
    title: String,
    content: String,
    scheduledDate: Date,
});
const ScheduledDiary = mongoose.model('ScheduledDiary', scheduledDiarySchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Routes
// Home - List all diary entries with pagination, latest first
app.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 7;
    const skip = (page - 1) * limit;
    
    const totalEntries = await Diary.countDocuments();
    const diaries = await Diary.find()
                              .sort({ date: -1 })
                              .skip(skip)
                              .limit(limit);
    
    res.render('index', { 
        diaries, 
        currentPage: page, 
        totalPages: Math.ceil(totalEntries / limit) 
    });
});

// Show form to create a new entry
app.get('/new', (req, res) => {
    res.render('new');
});

// Create new diary entry (scheduled for later)
app.post('/new', async (req, res) => {
    const scheduledDateTime = new Date(req.body.scheduledDateTime);

    await ScheduledDiary.create({ 
        title: req.body.title, 
        content: req.body.content, 
        scheduledDate: scheduledDateTime 
    });

    res.redirect('/');
});

// Move scheduled entries to the main diary collection when due
cron.schedule('* * * * *', async () => {
    const now = new Date();
    const dueEntries = await ScheduledDiary.find({ scheduledDate: { $lte: now } });

    for (const entry of dueEntries) {
        await Diary.create({ title: entry.title, content: entry.content });
        await ScheduledDiary.findByIdAndDelete(entry._id); 
    }

    console.log('Checked for scheduled entries.');
});

// Show form to edit an entry
app.get('/edit/:id', async (req, res) => {
    const diary = await Diary.findById(req.params.id);
    res.render('edit', { diary });
});

// Update diary entry
app.post('/edit/:id', async (req, res) => {
    await Diary.findByIdAndUpdate(req.params.id, { title: req.body.title, content: req.body.content });
    res.redirect('/');
});

// Delete diary entry
app.post('/delete/:id', async (req, res) => {
    await Diary.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

// Duplicate diary entry
app.post('/duplicate/:id', async (req, res) => {
    const diary = await Diary.findById(req.params.id);
    await Diary.create({ title: diary.title + ' (Copy)', content: diary.content });
    res.redirect('/');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
