
const express = require('express');
const app = express();
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const MongoDbClient = require("mongodb").MongoClient;
const pgClient = require("pg");
const sha1 = require("sha1");

// app port
const port = 3367;

// response data
let data = {};	

/* this line tells Express to use the CERIGame folder as our static folder
 from which we can serve static files like css, images etc
 */
app.use(express.static('CERIGame/dist/CERIGame/'));

// Use express Json 
app.use(express.json());

// Data source name mongo db
const dsnMongoDB = "mongodb://localhost:27017/db";

// Start server on port=port
app.listen(port, function () {
  console.log('Example app listening on port '+port);
});

/* MongoDBStore Session initialization */
app.use(
  session({
    secret: "secret",
    saveUninitialized: false,
    resave: false,
    store: new MongoDBStore({
      uri: "mongodb://localhost:27017/db",
      collection: "mySessions",
      touchAfter: 24 * 3600
    }),
    cookie: { maxAge: 24 * 3600 * 1000 }
  })
);

// pg pool DB instace
var pool = new pgClient.Pool({
  user: "uapv1900318",
  host: "pedago01c.univ-avignon.fr",
  database: "etd",
  password: "y5l6K8",
  port: 5432
});

// app root
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/CERIGame/dist/CERIGame/index.html');
});

// login to the app
app.post('/login', function (req, res) {
  var login = req.body.login;
  var password = req.body.password;

  // sql request
  sql ="select * from fredouil.users where identifiant='"+login+"';";

  // connection to database

  pool.connect(function(err, client, done) {

    if (err) {
      console.log("Error connecting to pg server" + err.stack);
    } else {
      console.log("Connection established with pg db server");
    }

    // Exécution de la requête SQL et resultats stocké dans le param result
    client.query(sql, (err, result) => {

      if (err) {
        console.log("Erreur d’exécution de la requete" + err.stack);
        // response data to client
        res.end(JSON.stringify({ isLogged: false }));
      } else if (result.rows[0] != null && result.rows[0].motpasse == sha1(password)) {
        console.log(result.rows[0]);
        
        req.session.isConnected = true;
        data.user=result.rows[0];
        data.isLogged=true;

        // Updating connection status to 1 (connected)
        updateStatus(login, 1);

        // response data to client
        res.end(JSON.stringify(data));

      } else {
        console.log(result);
        console.log("Connexion échouée : informations de connexion incorrecte");
        data.isLogged=false;
        // response data to client
        res.end(JSON.stringify(data));
      }
    });
    
    client.release();
  });

});

// logout from the app
app.get('/logout', function (req, res) {

  // get user login from data
  let login=data.user.identifiant;
  // set the session as disconnected
  req.session.isConnected = false;
  // set data isLogged to false
  data.isLogged=false;

  // Updating connection status to 0 (disconnected)
  updateStatus(login, 0);

  // response data to client
  res.end(JSON.stringify(data));
});

// Login or logout status (0 or 1)
function updateStatus(identifiant, status){
  var sql = "update fredouil.users SET statut_connexion ='"+status+"' where identifiant = '"+identifiant+"';";	
	
	pool.connect (function (err,client,done) {
		client.query(sql, function (err, result) {
				if(err) {
					console.log("Erreur d’exécution de la requete" + err.stack);
					}
					else{
						console.log("modification su status du user",identifiant);
					}	
		})
		client.release();
	})
};

// History of a user
app.get ('/history', function(req, res){

  // get id of the connected user
  var id_user = req.query['id_user'];

	var sql = "select * from fredouil.historique where id_user = "+id_user+";";	
	
	pool.connect (function (err,client,done) {
		client.query(sql, function (err, result) {
				if(err) {
					console.log("Erreur d’exécution de la requete" + err.stack);
				}
        else{
          data.history = result.rows;	
        }
        // response data to client
				res.send(JSON.stringify(data));
		})
		client.release();
  });
  
});

// Add new history
app.post("/history", (request, response) => {

  // Get history data from user
  var id_user = request.body.id_user;
  var date_jeu = request.body.date_jeu;
  var niveau_jeu = request.body.niveau_jeu;
  var nb_reponses_corr = request.body.nb_reponses_corr;
  var temps = request.body.temps;
  var score = request.body.score;

  var sql ="INSERT INTO fredouil.historique (id_user, date_jeu, niveau_jeu, nb_reponses_corr, temps, score) VALUES (" +
    id_user + ",'" + date_jeu + "'," + niveau_jeu + "," + nb_reponses_corr + ", " +
    temps + ", " + score + ");";

  pool.connect(function(err, client, done) {
    if (err) {
      console.log("Error connecting to pg server" + err.stack);
    } else {
      console.log("connection established with the server");
    }
    client.query(sql, (err, result) => {
      if (err) {
        console.log("Erreur d’exécution de la requete" + err.stack);
      } else {
        data.status = "historique enregistré";
      }
      // response data to client
      response.send(data);
    });
    client.release();
  });

});

// get list of users
app.get ('/users', function(req, res){
	var sql = "select * from fredouil.users;";	
	
	pool.connect (function (err,client,done) {
		client.query(sql, function (err, result) {
				if(err) {
					console.log("Erreur d’exécution de la requete" + err.stack);
					}
        else{
          data.users = result.rows;	
        }	
        // response data to client
        res.send(JSON.stringify(data));
		})
		client.release();
	})			
});


// liste of quizz
app.get ('/quizz', function(req, res){
  
  // Connection to mongo db
	MongoDbClient.connect(dsnMongoDB, { useNewUrlParser: true }, function(err, db) {
    if (err) throw err;
    
	  var dbquizz = db.db("db");
      
    // Get quiz from quizz table
    dbquizz.collection("quizz").find({}).toArray(function(err, result) {
        if (err) throw err;

          data.quizz = result;
          // response data to client
          res.send(JSON.stringify(data));
          db.close();
      });
    });

});
