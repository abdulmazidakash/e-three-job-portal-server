const express = require('express');
const cors = require('cors');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 3000 ;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


//middleware
app.use(cors())
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_PASS}:${process.env.DB_USER}@cluster0.j0hxo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


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

	const jobsCollection = client.db('threeJobPortal').collection('threeJobs');
	const jobApplicationCollection = client.db('threeJobPortal').collection('jobs_collection');



	// //get all jobs data
	// app.get('/jobs', async(req, res)=>{
	// 	const email = req.query.email;
	// 	const query = {};
	// 	// if(email){
	// 	// 	const query = { hr_email: email};
	// 	// }
	// 	if(email){
	// 		query = { hr_email: email}
	// 	}
	// 	const cursor = jobsCollection.find(query);
	// 	// console.log(cursor);
	// 	const result = await cursor.toArray();
	// 	// console.log(result);
	// 	res.send(result);
	// })

	// Get all jobs data
	app.get('/jobs', async (req, res) => {
		const email = req.query.email;
		const query = {};  // Initialize the query object
		if (email) {
		query.hr_email = email;  // Modify the existing query object
		}

		const cursor = jobsCollection.find(query);
		const result = await cursor.toArray();
		res.send(result);
		});


	//get job details
	app.get('/jobs/:id', async(req, res)=>{
		const id = req.params.id;
		// console.log(id);
		const query = { _id: new ObjectId(id)};
		const result = await jobsCollection.findOne(query);
		// console.log(result);
		res.send(result);
	})

	//job applications apis
	app.post('/job-applications', async(req, res) =>{
		const application = req.body;
		const result = await jobApplicationCollection.insertOne(application);

		//not the best way 
		const id = application.job_id;
		const query = { _id: new ObjectId(id)};
		const job = await jobsCollection.findOne(query);
		console.log(job);
		let newCount = 0;
		if(job.applicationCount){
			newCount = job.applicationCount + 1;

		}
		else{
			newCount = 1;
		}

		//now update the job info
		const filter = { _id: new ObjectId(id)};
		const updateDoc = {
			$set: {
				applicationCount: newCount
			}
		}

		const updateResult = await jobsCollection.updateOne(filter, updateDoc)
		res.send(result);
	})

	//app.get('/job-applications/jobs/:job_id') get specific job application job by id
	app.get('/job-applications/jobs/:job_id', async(req, res) =>{
		const jobId = req.params.job_id;
		const query = { job_id: jobId};
		const result = await jobApplicationCollection.find(query).toArray();
		res.send(result);
	})



	//job add post apis
	app.post('/jobs', async(req, res) =>{
		const newJob = req.body;
		const result = await jobsCollection.insertOne(newJob);
		res.send(result);
	})


	//specific user data get
	app.get('/job-application', async(req, res) =>{
		const email = req.query.email;
		const query = { applicant_email: email};
		const result = await jobApplicationCollection.find(query).toArray();


		//fokira way to aggregate data 
		for(const application of result){
			console.log(application.job_id);

			const query1 = { _id: new ObjectId(application.job_id)};
			const job = await jobsCollection.findOne(query1);
			console.log(job);

			if(job){
				application.title = job.title;
				application.company = job.company;
				application.company_logo = job.company_logo;
				application.location = job.location;
			}
		}
		res.send(result);
	})


	//update job review
	app.patch('/job-applications/:id', async(req, res) =>{
		const id = req.params.id;
		const data = req.body;
		const filter = { _id: new ObjectId(id)};
		const updatedDoc = {
			$set: {
				status: data.status
			}
		}
		const result = await jobApplicationCollection.updateOne(filter, updatedDoc);
		res.send(result);
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



//
app.get('/', (req, res) =>{
	res.send('job is falling from the sky')
})

app.listen(port, ()=>{
	console.log(`job portal server is running: ${port}`);
})