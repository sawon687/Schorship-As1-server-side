require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_API_KEY);
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 3000;

// Middleware is
app.use(cors());
app.use(express.json());

// Firebase Admin Initialization
admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.SERVICE_ACCOUNT_TYPE,
    project_id: process.env.SERVICE_ACCOUNT_PROJECT_ID,
    private_key_id: process.env.SERVICE_ACCOUNT_PRIVATE_KEY_ID,
    private_key: process.env.SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.SERVICE_ACCOUNT_CLIENT_EMAIL,
    client_id: process.env.SERVICE_ACCOUNT_CLIENT_ID,
    auth_uri: process.env.SERVICE_ACCOUNT_AUTH_URI,
    token_uri: process.env.SERVICE_ACCOUNT_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.SERVICE_ACCOUNT_AUTH_CERT_URL,
    client_x509_cert_url: process.env.SERVICE_ACCOUNT_CLIENT_CERT_URL,
    universe_domain: process.env.SERVICE_ACCOUNT_UNIVERSE_DOMAIN,
  }),
});

// Verify Firebase Token Middleware
const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).send({ message: 'Unauthorized access' });
  try {
    const idToken = token.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    res.status(401).send({ message: 'Unauthorized access' });
  }
};

// MongoDB Connection
const uri = `mongodb+srv://${process.env.MDB_NAME}:${process.env.MDB_PASS}@cluster0.ofja8we.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Main Function is
async function run() {
  try {
    // await client.connect();
    const db = client.db('scholarshipDB');
    const scholarshipsColl = db.collection('scholarshipsColl');
    const userColl = db.collection('userColl');
    const applicationsColl = db.collection('applicationsCollection');
    const reviewscoll = db.collection('reviewscoll');
    const paymentsColl = db.collection('paymentsColl');

    // verify moderator
    const verifyModerator = async (req, res, next) => {
      const email = req.decoded_email;
      const user = await userColl.findOne({ email });
      if (!user || (user.role !== 'moderator' && user.role !== 'admin')) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    }

    // verify admin api
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const user = await userColl.findOne({ email });
      if (!user || user.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    }

    // root
    app.get('/', (req, res) => {
      res.send('Hello World!');
    });

    //  scholarships crud section
    app.post('/scholarships', verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const scholarshipInfo = req.body;
        scholarshipInfo.scholarshipPostDate = new Date();
        const result = await scholarshipsColl.insertOne(scholarshipInfo);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Insert failed', error: err.message });
      }
    });

    //  single id scholarship
    app.get('/scholarships/:id', async (req, res) => {
      const id = req.params.id;
      const result = await scholarshipsColl.findOne({ _id: new ObjectId(id) });
      res.send(result);
  })
      // scholarship display api
    app.get('/scholarships', async (req, res) => {
      try {
        const { limit, skip, search, subject, category } = req.query;
        console.log('category,',subject)
        const query = {};
        if (search) {
          query.$or = [
            { scholarshipName: { $regex: search, $options: 'i' } },
            { universityName: { $regex: search, $options: 'i' } },
            { degree: { $regex: search, $options: 'i' } },
          ];
        }
        if (subject) query.subjectCategory = subject;
        if (category) query.scholarshipCategory = category;

        const result = await scholarshipsColl
          .find(query)
          .limit(Number(limit) || 0)
          .skip(Number(skip) || 0)
          .sort({ scholarshipPostDate: -1 })
          .toArray();
        const count = await scholarshipsColl.countDocuments(query);

        res.send({ scholarData: result, totalScholar: count });
      } catch (err) {
        res.status(500).send({ message: 'Fetch failed', error: err.message });
      }

    });
    
    // scholrhip id details page 
    app.get('/scholarships/:id', verifyFBToken, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await scholarshipsColl.findOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Fetch failed', error: err.message });
      }
    });
// scholrhip update api
    app.patch('/scholarships/:id', verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updateInfo = req.body;
        const result = await scholarshipsColl.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateInfo }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Update failed", error });
      }
    });
// scholrhip delete api
    app.delete('/scholarships/:id', verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await scholarshipsColl.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Delete failed", error });
      }
    });

    // users
    app.post('/user', async (req, res) => {
      try {
        const userInfo = req.body;
        userInfo.role = "student";
        userInfo.createAT = new Date();

        const alreadyUser = await userColl.findOne({ email: userInfo.email });
        if (alreadyUser) return res.send({ message: 'User already exists' });

        const result = await userColl.insertOne(userInfo);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Insert failed', error: err.message });
      }
    });

    app.get('/user', verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const role = req.query.role;
        const query = {};
        if (role) query.role = role;
        const result = await userColl.find(query).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Fetch failed', error: err.message });
      }
    });

    app.get('/user/:email/role', verifyFBToken, async (req, res) => {
      try {
        const email = req.params.email;
        const user = await userColl.findOne({ email });
        res.send({ role: user?.role || 'user' });
      } catch (err) {
        res.status(500).send({ message: 'Fetch failed', error: err.message });
      }
    });

    app.patch('/user/:id', verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updateinfo = req.body;
        const result = await userColl.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role: updateinfo.role } }
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Update failed', error: err.message });
      }
    });

    app.delete('/user/:id', verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await userColl.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Delete failed', error: err.message });
      }
    });

    // applications
    app.post('/applications', verifyFBToken, async (req, res) => {
      try {
        const application = {
          ...req.body,
          applicationStatus: 'pending',
          paymentStatus: 'unpaid',
          applicationDate: new Date(),
        };
        
        const result = await applicationsColl.insertOne(application);
        res.send({ applicationId: result.insertedId });
      } catch (err) {
        res.status(500).send({ message: 'Insert failed', error: err.message });
      }
    });

    app.get('/application', verifyFBToken, async (req, res) => {
      try {
        const email = req.query.email;
        const query = {};
        if (email) {
          if (email !== req.decoded_email)
            return res.status(403).send({ message: 'Forbidden access' });
          query.userEmail = email;
        }
        const result = await applicationsColl.find(query).sort({applicationDate:'-1'}).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Fetch failed', error: err.message });
      }
    });

    app.patch('/application/:id', verifyFBToken, verifyModerator, async (req, res) => {
      try {
        const id = req.params.id;
        const updateData = req.body;
        const result = await applicationsColl.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Update failed', error: err.message });
      }
    });

    app.delete('/application/:id', verifyFBToken, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await applicationsColl.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Delete failed', error: err.message });
      }
    });

    // reviews 
    app.post('/reviews', verifyFBToken, async (req, res) => {
      try {
        const review = { ...req.body, date: new Date() };
        const result = await reviewscoll.insertOne(review);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Insert failed', error: err.message });
      }
    });
// api disp
    app.get('/reviews',  async (req, res) => {
      try {
        const { email, id } = req.query;
        const query = {};
        if (id) query.scholarshipId = id;
        if (email) query.userEmail = email;
        const result = await reviewscoll.find(query).sort({ date: -1 }).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Fetch failed', error: err.message });
      }
    });

    app.patch('/reviews/:id', verifyFBToken,  async (req, res) => {
      try {
        const id = req.params.id;
        const reviewInfo = req.body;
        const result = await reviewscoll.updateOne(
          { _id: new ObjectId(id) },
          { $set: { rating: reviewInfo.rating, reviewComment: reviewInfo.userComment } }
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Update failed', error: err.message });
      }
    });

    app.delete('/reviews/:id', verifyFBToken, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await reviewscoll.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Delete failed', error: err.message });
      }
    });

 // Stripe Payment
  app.post('/create-checkout-session', verifyFBToken, async(req, res) => {
    try {
      const { applicationId } = req.body;
      if (!applicationId || !ObjectId.isValid(applicationId))
        return res.status(400).json({ error: 'Invalid application id' });

        const application = await applicationsColl.findOne({ _id: new ObjectId(applicationId) });
        if (!application) return res.status(404).json({ error: 'Application not found' });

        if (application.paymentStatus === 'paid')
          return res.status(400).json({ error: 'Already paid' });

        const scholarshipcoll = await scholarshipsColl.findOne({ _id: new ObjectId(application.scholarshipId) });
        const totalAmount = Number(application.applicationFees || 0) + Number(application.serviceCharge || 0);
        if (!totalAmount || totalAmount <= 0)
          return res.status(400).json({ error: 'Invalid amount' });

        const session = await stripe.checkout.sessions.create({
          customer_email: application.userEmail,
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'USD',
                product_data: { name: scholarshipcoll.scholarshipName || 'Scholarship' },
                unit_amount: totalAmount * 100,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/payment-failed?session_id={CHECKOUT_SESSION_ID}`,
          metadata: {
            applicationId: application._id.toString(),
            scholarshipId: application.scholarshipId.toString(),
            scholarshipName: scholarshipcoll.scholarshipName || '',
            userEmail: application.userEmail,
            username: application.username || '', // ADD username here
            universityName: application.universityName || '',
            degree: application.degree || '',
            subjectCategory: application.subjectCategory || '',
          },
        });

        res.send({ url: session.url });
      } catch (error) {
        console.error('Stripe error:', error);
        res.status(500).json({ error: error.message });
      }
    });


    


    // paymetn success api
  app.patch('/payment-success', async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) {
      return res.status(400).send({ success: false });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.send({ success: false });
    }

    const applicationId = session.metadata.applicationId;
    const scholarshipId = session.metadata.scholarshipId;

    const amountUSD = session.amount_total / 100;

    // update application
    await applicationsColl.updateOne(
      { _id: new ObjectId(applicationId) },
      { $set: { paymentStatus: 'paid' } }
    );

    // 🔒 duplicate safe insert
    await paymentsColl.updateOne(
      { sessionId },
      {
        $setOnInsert: {
          applicationId,
          scholarshipId,
          amount: amountUSD,
          paymentDate: new Date(),
        }
      },
      { upsert: true }
    );

   


    // Update application
    await applicationsColl.updateOne(
      { _id: new ObjectId(applicationId) },
      { $set: { userEmail, username, paymentStatus: "paid" } }
    );

    // Upsert payment
    await paymentsColl.updateOne(
      { sessionId }, // filter by sessionId
      {
        $set: { amount: amountUSD, currency: "USD" }, // always update amount/currency
        $setOnInsert: {
          scholarshipId,
          applicationId,
          userEmail,
          username,
          paymentDate: new Date(),
          sessionId,
        },
      },
      { upsert: true }
    );

      const scholarshipDetails = {
        scholarshipId,
        scholarshipName: session.metadata.scholarshipName,
        universityName: session.metadata.universityName,
        degree: session.metadata.degree,
        subject: session.metadata.subjectCategory,
        amount: amountUSD,
        paymentStatus: session.payment_status,
      };

      res.send({ success: true, scholarshipDetails });
    } catch (error) {
      console.error("Payment Error:", error);
      res.status(500).send({ success: false, error: error.message });
    }
  });


    // Payment Failed api
    app.get('/payment-failed', async (req, res) => {
      try {
        const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
        res.send({
          scholarshipName: session.metadata.scholarshipName,
          errorMessage: session.last_payment_error?.message || 'Payment cancelled',
        });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // payment analysis total sum api 
    app.get('/payment-analysis/total', verifyFBToken, verifyAdmin, async (req, res) => {
      const result = await paymentsColl.aggregate([
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            totalPayments: { $count: {} }
          }
        }
      ]).toArray();

      res.send(result[0] || { totalAmount: 0, totalPayments: 0 });
    });

    // Test ping
    // await client.db("admin").command({ ping: 1 });
    // console.log("MongoDB connected successfully!");
  } finally {
    // Do not close the client in long-running server
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

