const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
require('dotenv').config()
const app = express();
const port = process.env.PORT || 3000 ;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


//middleware
app.use(cors({
	origin: [
		'http://localhost:5173', 
		'http://localhost:5174', 
		'https://three-job-portal.web.app' ,
		'https://three-job-portal.firebaseapp.com', 
		'https://three-job-portal.web.appthree-job-portal.web.app', 
		'https://three-job-portal.netlify.app',
		'https://three-job-portal-server.vercel.app', 
		
	],
	credentials: true,
}))
app.use(express.json());
app.use(cookieParser());

//jwt token middleware
const logger = (req, res, next) =>{
	console.log('inside the logger');

	next();
}

const verifyToken = (req, res, next) =>{
	// console.log('inside verify token middleware', req.cookies);

	const token = req?.cookies?.token;

	if(!token){
		return res.status(401).send({message: 'unauthorized access'});
	}

	jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) =>{

		if(err){
			return res.status(401).send({message: 'unauthorized access'});
		}

		req.user = decoded;
		next();
	})

}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j0hxo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


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
    // await client.connect();

	const jobsCollection = client.db('threeJobPortal').collection('threeJobs');
	const jobApplicationCollection = client.db('threeJobPortal').collection('jobs_collection');


	//auth related apis
	app.post('/jwt', async(req, res)=>{
		const user = req.body;
		const token = jwt.sign(user, process.env.JWT_TOKEN, {expiresIn: '1d'});
		res
		.cookie('token', token, {
			httpOnly: true,
			secure: process.env.NODE_ENV=== 'production',
			sameSite: process.env.NODE_ENV === 'production' ? 'none': 'strict',

		})
		// .send(token);
		.send({success: true})

	})

	//jwt logout token clear cookie
	app.post('/logout', (req, res) =>{
		res
		.clearCookie('token', {
			httpOnly: true,
			secure: process.env.NODE_ENV=== 'production',
			sameSite: process.env.NODE_ENV === 'production' ? 'none': 'strict',
		})
		.send({success: true})
	})

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

		// console.log('now inside api callback');
		const email = req.query.email;
		const sort = req.query?.sort;
		const search = req.query?.search;
		const min = req.query?.min;
		const max = req.query?.max;

		let query = {};  // Initialize the query object
		let sortQuery = {};

		//some query related code 
		console.log(req.query);
		if (email) {
		query.hr_email = email;  // Modify the existing query object
		}

		if(sort == 'true'){
			sortQuery= {'salaryRange.min': -1}
		}

		if(search){
			query.location= { $regex: search, $options: 'i'}
		}
		// console.log(search);
		if(min && max){
			query = {
				...query,
				"salaryRange.min": { $gte: parseInt(min)},
				"salaryRange.max": { $lte: parseInt(max)},

			}
		}

		const cursor = jobsCollection.find(query).sort(sortQuery);
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
		// console.log(job);
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
	app.get('/job-application', verifyToken, async(req, res) =>{
		const email = req.query.email;
		const query = { applicant_email: email};

		if(req.user.email !== req.query.email){
			return res.status(403).send({message: 'forbidden access'})
		}

		// console.log('cuk cuk cookies', req.cookies);
		const result = await jobApplicationCollection.find(query).toArray();


		//fokira way to aggregate data 
		for(const application of result){
			// console.log(application.job_id);

			const query1 = { _id: new ObjectId(application.job_id)};
			const job = await jobsCollection.findOne(query1);
			// console.log(job);

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
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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