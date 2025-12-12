const express = require('express')
const app = express()
const port =process.env.PORT|| 3000;
const cors=require('cors')
app.use(cors())
app.use(express.json())
require('dotenv').config()
app.get('/', (req, res) => {
  res.send('Hello World!')
})



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri =`mongodb+srv://${process.env.MDB_NAME}:${process.env.MDB_PASS}@cluster0.ofja8we.mongodb.net/?appName=Cluster0`;

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

    const db=client.db('scholarshipDB');
    const scholarshipsColl=db.collection('scholarshipsColl');
    const userColl=db.collection('userColl');
    // post scholarshipsColl
    app.post('/scholarships',async(req,res)=>{
         const scholarshipInfo=req.body;
          scholarshipInfo.scholarshipPostDate=new Date()
        
       const result= await scholarshipsColl.insertOne(scholarshipInfo);
       res.send(result)
    })
    // scholarships get data
    app.get('/scholarships',async(req,res)=>{
        const  result=await scholarshipsColl.find().toArray()
        res.send(result);
    })
    //  singe scholarshps id
    app.get('/scholarships/:id',async(req,res)=>{
        const  id=req.params.id
        const query={_id: new ObjectId(id)}
        const  result=await scholarshipsColl.findOne(query)
        res.send(result);
    })
    app.post('/user',async(req,res)=>{
          const userInfo=req.body;
          userInfo.role="student";
          userInfo.createAT=new Date()
          const  query={email: userInfo.email}
      
          const  alreadyUser=await userColl.findOne(query)
          if(alreadyUser)
          {
             return
          }
          
          const result=await userColl.insertOne(userInfo)
          res.send(result)
    })
    // user get

    app.get('/user',async(req,res)=>{
        const role=req.query.role
        const query={role}
       
        const result=await userColl.find(query).toArray();
        res.send(result);
    })

    app.patch('/user/:id',async(req,res)=>{
        const id=req.params.id;
        const query={_id: new ObjectId(id)}
        const  updateinfo=req.body
            const  update={
            $set:{
               role:updateinfo.role
            }
          }
          const result =await userColl.updateOne(query,update)

          res.send(result)
         
    })

    app.delete('/user/:id',async(req,res)=>{
        const id=req.params.id;
        const query={_id: new ObjectId(id)};
        const result=await userColl.deleteOne(query)
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