const express = require('express')
const app = express()
const port = process.env.PORT || 3000;
const cors = require('cors')
app.use(cors())
app.use(express.json())
require('dotenv').config()
app.get('/', (req, res) => {
  res.send('Hello World!')
})



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.MDB_NAME}:${process.env.MDB_PASS}@cluster0.ofja8we.mongodb.net/?appName=Cluster0`;
const stripe = require('stripe')(`${process.env.STRIPE_API_KEY}`);
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db('scholarshipDB');
    const scholarshipsColl = db.collection('scholarshipsColl');
    const userColl = db.collection('userColl');
    const applicationsColl = db.collection('applicationsCollection')
    // post scholarshipsColl
    app.post('/scholarships', async (req, res) => {
      const scholarshipInfo = req.body;
      scholarshipInfo.scholarshipPostDate = new Date()

      const result = await scholarshipsColl.insertOne(scholarshipInfo);
      res.send(result)
    })
    // scholarships get data
    app.get('/scholarships', async (req, res) => {
      const query = { scholarshipPostDate: "-1" }
      const result = await scholarshipsColl.find().sort(query).toArray()
      res.send(result);
    })
    //  singe scholarshps id
    app.get('/scholarships/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }

      const result = await scholarshipsColl.findOne(query)
      res.send(result);
    })
    app.post('/user', async (req, res) => {
      const userInfo = req.body;
      userInfo.role = "student";
      userInfo.createAT = new Date()
      const query = { email: userInfo.email }

      const alreadyUser = await userColl.findOne(query)
      if (alreadyUser) {
        return
      }

      const result = await userColl.insertOne(userInfo)
      res.send(result)
    })
    // user get

    app.get('/user', async (req, res) => {
      const role = req.query.role
      const query = { role }

      const result = await userColl.find(query).toArray();
      res.send(result);
    })

    app.patch('/user/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const updateinfo = req.body
      const update = {
        $set: {
          role: updateinfo.role
        }
      }
      const result = await scholarshipsColl.updateOne(query, update)

      res.send(result)

    })

    app.patch('/user/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }

      const updateinfo = req.body
      const update = {
        $set: {
          role: updateinfo.role
        }
      }
      const result = await userColl.updateOne(query, update)

      res.send(result)

    })

    app.patch('/scholarships/:id', async (req, res) => {
      const id = req.params.id;
      const updateScholar = req.body
      const query = { _id: new ObjectId(id) };

      updateScholar.scholarshipPostDate = new Date()
      const update = {
        $set: {
          updateScholar
        }
      }
      const result = await scholarshipsColl.updateOne(query, update)
      res.send(result)
    })

    app.delete('/scholarships/:id', async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };


      const result = await scholarshipsColl.deleteOne(query)
      res.send(result)
    })
//  payment api
app.post('/create-checkout-session', async (req, res) => {
  try {
    const application = req.body;

    const session = await stripe.checkout.sessions.create({
      customer_email: application.email, // ✅ only email supported
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'USD',
            product_data: {
              name: application.scholarshipName,
              images: [application.universityImage],
            },
            unit_amount: application.totalAmount * 100,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_DOMAIN}/payment-failed`,
      metadata: {
        scholarshipId: application._id,
       scholarshipName: application.scholarshipName,
        userName: application.displayName, // ✅ FIXED
        userEmail: application.email,
        universityName: application.universityName,
        scholarshipCategory: application.scholarshipCategory,
        subjectCategory:application.subjectCategory,
        degree: application.degree,
        applicationFees: application.applicationFees,
        serviceCharge: application.serviceCharge,
        applicationStatus: 'pending',
      },
    });

    const applicationInfo = {
      scholarshipId: session.metadata.scholarshipId,
      userName: session.metadata.userName,
      userEmail: session.customer_email, // ✅ FIXED
      universityName: session.metadata.universityName,
      scholarshipCategory: session.metadata.scholarshipCategory,
      subjectCategory:session.metadata.subjectCategory,
      degree: session.metadata.degree,
      applicationFees: session.metadata.applicationFees,
      serviceCharge: session.metadata.serviceCharge,
      applicationStatus: session.metadata.applicationStatus,
      paymentStatus: 'unpaid',
      applicationDate: new Date(),
    };

    const result = await applicationsColl.insertOne(applicationInfo);

    res.send({ url: session.url, applicationId: result.insertedId });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});



// payment check

app.patch('/payment-success',async(req,res)=>{
  const sessionId=req.query.session_id
  const session= await stripe.checkout.sessions.retrieve(sessionId);
  console.log('sesstion id',session)
  console.log(sessionId)
  

    if(session.payment_status=='paid')
    {  

      const  id=session.metadata.scholarshipId
      const  query={ scholarshipId:id}
         const update={
       $set:{
         paymentStatus:'paid'
       }

       
      }
         
      const result=await applicationsColl.updateOne(query,update)
         const ScholarshipDetails = {
      scholarshipId: session.metadata.scholarshipId,
      scholarshipName:session.metadata.scholarshipName,
      universityName: session.metadata.universityName,
      degree: session.metadata.degree,
      subject:session.metadata.subjectCategory,
      amount:session.amount_total/100,
      amoutnPaid:session.payment_status,

    };
      return res.send({success:true,result,ScholarshipDetails})

    }
  
    res.send({ message: 'Payment not completed' });
})
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})