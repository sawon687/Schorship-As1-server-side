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
    const reviewscoll=db.collection('reviewscoll')
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

app.post('/applications', async (req, res) => {
  const { scholarshipId } = req.body;


            //  const alreadyexit=await applicationsColl.findOne({scholarshipId})

            //  if(alreadyexit)
            //  {
            //         return res.send({ applicationId: alreadyexit._id })
            //  }

  const application = {
    ...req.body,
    applicationStatus: 'pending',
    paymentStatus: 'unpaid',
    applicationDate: new Date(),
  };

  const result = await applicationsColl.insertOne(application);
  res.send({ applicationId: result.insertedId });
});
// application status cahnged
 
app.patch('/application/:id',async(req,res)=>{
   const id=req.params.id;
   const {applicationStatus}=req.body
   const query={_id:new ObjectId(id)}
   const update={
     $set:{
        applicationStatus:applicationStatus,
     }
   }
   const result=await applicationsColl.updateOne(query,update)
   res.send(result)
})

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { applicationId } = req.body;
          console.log('id',applicationId)
    if (!applicationId || !ObjectId.isValid(applicationId)) {
      return res.status(400).json({ error: 'Invalid application id' });
    }

    const application = await applicationsColl.findOne({
      _id: new ObjectId(applicationId),
    });
    console.log('appli',application)
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }


    if (application.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Already paid' });
    }

    // ✅ correct scholarship lookup
    const scholarshipcoll = await scholarshipsColl.findOne({
      _id: new ObjectId(application.scholarshipId),
    });
   console.log('scholahip',scholarshipcoll)
    const totalAmount =
      Number(application.applicationFees || 0) +
      Number(application.serviceCharge || 0);

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: application.userEmail,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'USD',
            product_data: {
              name: application.universityName,
            },
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
        universityName: application.universityName,
        degree: application.degree,
        subjectCategory: application.subjectCategory,
      },
    });
 console.log('sesston data',session)
    res.send({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// application review
app.post('/reviews',async(req,res)=>{
       const review=req.body
        const reviewInfo={
          ...review,
          date:new Date()
        }
       const result=await reviewscoll.insertOne(reviewInfo);

       res.send(result)
})
// review get display fronted
app.get('/reviews',async(req,res)=>{
   const  email=req.params.email
   const query={}
   if(email)
   {
      query.userEmail=email
   }
   const  result=await reviewscoll.find(query).sort({date:'-1'}).toArray()

   res.send(result)
})
// revies update 
app.patch('/reviews/:id',async(req,res)=>{
        const id=req.params.id;
        const reviewInfo=req.body
        console.log('review info',reviewInfo)
        const query={_id: new ObjectId(id)};
        const update={
             $set:{
              rating:reviewInfo.rating,
              reviewComment:reviewInfo.userComment,
             }
        }
        const result=await reviewscoll.updateOne(query,update)

        res.send(result)
})
// reviews delete
app.delete('/reviews/:id',async(req,res)=>{
    const id=req.params.id;
    const query={_id:new ObjectId(id)};
    const result=await reviewscoll.deleteOne(query)
    res.send(result)
})

// payment check

app.patch('/payment-success',async(req,res)=>{
  const sessionId=req.query.session_id
  const session= await stripe.checkout.sessions.retrieve(sessionId);
  console.log('sesstion id',session)
  console.log(sessionId)
  

    if(session.payment_status==='paid')
    {  

      const  id=session.metadata.scholarshipId
      const  query={ scholarshipId:id}
         const update={
       $set:{
         paymentStatus:'paid'
       }

       
      }
         
      const result=await applicationsColl.updateOne(query,update)
       console.log('result:',result)
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
  
    res.send({ message: 'Payment not completed',scholarshipName:session.metadata.scholarshipName, });
})
// paymetn-failed
app.get('/payment-failed', async (req, res) => {
  const session = await stripe.checkout.sessions.retrieve(
    req.query.session_id
  );

  res.send({
    scholarshipName: session.metadata.scholarshipName,
    errorMessage: session.last_payment_error?.message || 'Payment cancelled',
  });
}); 



// application get display

app.get('/application',async(req,res)=>{
   const  userEmail=req.query.email;
   const   query={}
   if(userEmail)
   {
     query.userEmail=userEmail
   }
   const result=await applicationsColl.find(query).toArray()

   res.send(result)
})


// application deleted id

app.delete('/application/:id',async(req,res)=>{
   const  id=req.params.id;
   const   query={_id: new ObjectId(id)}

   const result=await applicationsColl.deleteOne(query)

   res.send(result)
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