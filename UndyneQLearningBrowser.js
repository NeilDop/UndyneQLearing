// ==UserScript==
// @name        UndyneBot
// @namespace   Undynebot
// @include     http://joezeng.github.io/fairdyne/
// @version     1
// @grant       GM_xmlhttpRequest
// @grant       unsafeWindow
// ==/UserScript==

//Bot Settings

//Settings for the state space in spear phase
var min_State_Space = -200;
var max_State_Space = 200;
var state_Step_Size = 10;

// Random Exploration Settings
var random_Exploration_Rate = 0.7;
var min_Random_Exploration_Rate = 0.05;
var random_Exploration_Falloff =  (random_Exploration_Rate - min_Random_Exploration_Rate) / 200;

//Learn Rate Settings
var initial_Learn_Rate = bot_Learn_Rate = 0.7;
var min_Learn_Rate = 0.2;
var bot_Learn_Rate_Decline = (bot_Learn_Rate - min_Learn_Rate) / 500; //Reach min learn rate after 1000 Iterations

//Discount rate
var bot_Discount = 0.752;

//Rewards
var rewards = {survive: 1, hit: -50000};

var saveToFile = false; // Only works if write.php is available in local host!
var writerPath = "http://localhost/UndyneBotLog/"; 
var updateInterval = 20;
var qValues = {};


//Helper Variables
var arrowDmg = 0;
var spearDmg = 0;
var oldArrowCount = 0;
var itterationCount = 0;
var oldHP = 0;
var previousState = "";
var bot_pressed_key = '';
var bot_Last_State; 
var bot_Last_Action;
var gamesPlayed = 0;
var handeledDeath = false;
var qMoves = []; // Exp tuples

function InitializeQValues()
{
	// Spear state space
	var directions = ["l", "u",  "r",  "d"];
	directions.forEach(function(entry) 
	{
		for(x = min_State_Space; x <= max_State_Space; x += state_Step_Size)
		{
			for(y = min_State_Space; y <= max_State_Space; y += state_Step_Size)
			{
				var qString = "";
				qString += entry;
				qString += "_";
				qString += x;
				qString += "_";
				qString += y;
				qValues[qString] = [0,0,0,0];
			}
		}
	});
	
	// Arrow state space
    qValues["up"] 	 = 	[0,0,0,0];
    qValues["down"]  = 	[0,0,0,0];
    qValues["left"]  = 	[0,0,0,0];
    qValues["right"] = 	[0,0,0,0];
}

InitializeQValues();

function get_Projectile_Count()
{
	var count = 0;
	count += arrows.length;
	count += spears.length;
	count += pikes.length;
	return count;
}


function get_Point_Distance(x1, y1, x2, y2)
{
	var xdif = Math.abs(x1 - x2);
	var ydif = Math.abs(y1 - y2);
	var dist = Math.sqrt(Math.pow(xdif, 2) + Math.pow(ydif, 2));
	return dist;
}

function get_Highest_Index(qArray)
{
	var highestIndex = 0;
	var highestNumber = -10000000000000000;
	for (var i = 0; i < qArray.length; ++i)
	{
		//Will default to the last index if all actions are 0
		if(qArray[i] >= highestNumber)
		{
			highestNumber = qArray[i];
			highestIndex = i;
		}
	}  
	return highestIndex;
}

function randomInt(min, max)
{
	return Math.floor(Math.random() * (max - min + 1)) + 0;	
}

//ArrowBOT
function bot_Get_Action()
{
	
	if(get_Projectile_Count == 0)
	{
		console.log("None");
		return "none";
	}
	
	var qStateIdentifier = "up";
	if(attack_queue[0].type == 'arrow')
	{
			qStateIdentifier = get_State();
	}    
	else
	{
		qStateIdentifier = spear_get_State();
	}
	
	var qState = qValues[qStateIdentifier];
	var bestAction = 0;
  
	//Use random exploration. (Only in Spear phase)
	if(attack_queue[0].type == 'spear' && Math.random() <  random_Exploration_Rate)
	{
		bestAction = randomInt(0,3);	 
	}
	else
	{
		bestAction = get_Highest_Index(qState);
	}
  
	if(bot_Last_State && bot_Last_State !== null && bot_Last_State !== 'undefined')
    {
		if(bot_Last_Action !== null && bot_Last_Action !== 'undefined')
		{
			qMoves.push([bot_Last_State, bestAction, qStateIdentifier]);       
		}
		else
			console.log("LAST ACTION NULL!" + bot_Last_Action);
    }
	else
		console.log("LAST STATE NULL:" + bot_Last_State);
  
	bot_Last_State = qStateIdentifier;
	bot_Last_Action = bestAction;
  
  
	var actionString = "up";
  
	switch(bestAction) 
	{
		case 0:
			actionString = "up"; 
			break;
		case 1:
			actionString = "right"; 
			break;
		case 2:
			actionString = "down"; 
			break;
		case 3:
			actionString = "left"; 
			break;    
	}
	return actionString;
}

function bot_Update_Score( tookDamage)
{ 
	for (var i = 0; i < qMoves.length; ++i)
	{
		//Generate exp tuple
		var current = qMoves[i];
		var state = current[0];
		var act = current[1];
		var res_state = current[2];
		var reward = 0;
   
		// Penalty for beeing hit
		if(tookDamage == "hit" && i == qMoves.length-1)
		{
			reward = rewards.hit;
		}     
		else
		{
			//If in arrow state do not award anything for surviving alone
			if(state == "left" || state == "right" || state == "up" || state == "down")
			{
				continue;
			}
			reward = rewards.survive;
		}
	
		var result = (1- bot_Learn_Rate) * (qValues[state][act]) + (bot_Learn_Rate) * ( reward + (bot_Discount) * Math.max.apply(Math, qValues[res_state]));
    
		//console.log(result + " = " + (1- bot_Learn_Rate) + " * " + qValues[state][act] + " + " + bot_Learn_Rate + " * (" + reward + " + " + bot_Discount + " * " + Math.max.apply(Math, qValues[res_state]));
    
		qValues[state][act] = result;
      
	}
  
	qMoves = [];
	itterationCount++;
  
	//Reduce learn and exploration Rate over time
	if(bot_Learn_Rate > min_Learn_Rate)
	{
		bot_Learn_Rate -= bot_Learn_Rate_Decline;
		bot_Learn_Rate = Math.max(bot_Learn_Rate, min_Learn_Rate);
		console.log("Learn Rate:" + bot_Learn_Rate);
	}
	if(min_Random_Exploration_Rate < random_Exploration_Rate )
	{
		random_Exploration_Rate -= random_Exploration_Falloff;
		random_Exploration_Rate = Math.max(random_Exploration_Rate, min_Random_Exploration_Rate);
		console.log("Exploration rate:" +random_Exploration_Rate);
	}
   
}

function get_Rotation_Letter(rotation)
{
	//90° Angle per direction
	if(rotation >= 315 || rotation < 45)
	{
		return "u";
	}
	if(rotation >= 45 && rotation < 135)
	{
		return "r";
	}
	if(rotation >= 135 && rotation < 225)
	{
		return "d";
	}
	if(rotation >= 225 && rotation < 315)
	{
		return "l";
	}	
}

function spear_get_State()
{
	var currentSpear = get_closest_spear();
  
	// Calculate position of the tip of the spear
	var tip = { x: currentSpear.pos_x + currentSpear.direction.x * 23, y: currentSpear.pos_y + currentSpear.direction.y * 23};
	
	var realRotation =  (currentSpear.dest_rotation%1)*360;
	if(realRotation < 0)
	{
	   realRotation += 360;
	}
	var rotationLetter = get_Rotation_Letter(realRotation);
	var x = heart.sprite.position.x - tip.x;
	var y = heart.sprite.position.y - tip.y;
  
	var xNegative = (x < 0);
	var yNegative = (y < 0);
	x -= x%state_Step_Size;
	y -= y%state_Step_Size;
  
	//Clamp to state space min and max
	x = Math.min(x, max_State_Space);
	x = Math.max(x, min_State_Space);
	y = Math.min(y, max_State_Space);
	y = Math.max(y, min_State_Space);
  
	var stateName = "" +rotationLetter + "_" + x + "_" + y;
	return stateName;
}



function get_closest_arrow()
{
  var distance = [];
  distance['x'] = 10000;
  distance['y'] = 10000;
  distance['dist'] = 10000;
  
  var closestID = 0;
  
  for (var a = 0; a < arrows.length; ++a)
  {
    var currentPos = arrows[a].sprite.position;
    var dist = get_Point_Distance(currentPos.x, currentPos.y, heart.sprite.position.x, heart.sprite.position.y);
    if (dist < distance['dist'])
    {
      closestID = a;
      distance['dist'] = dist;
      distance['x'] = heart.sprite.position.x - currentPos.x;
      distance['y'] = heart.sprite.position.y - currentPos.y;
    }
  }
  
  return distance;
}

function get_closest_spear()
{
	var distance = [];
	distance['x'] = 10000;
	distance['y'] = 10000;
	distance['dist'] = 10000;
  
	var closestID = 0;
 
	for (var a = 0; a < spears.length; ++a)
	{
		var currentSpear = spears[a];
	  
		var tip = { x: currentSpear.pos_x + currentSpear.direction.x * 23, y: currentSpear.pos_y + currentSpear.direction.y * 23};
	
		var currentPos = spears[a].sprite.position;
		var dist = get_Point_Distance(tip.x, tip.y, heart.sprite.position.x, heart.sprite.position.y);
		if (dist < distance['dist'])
		{
			closestID = a;
			distance['dist'] = dist;
			distance['x'] = heart.sprite.position.x - currentPos.x;
			distance['y'] = heart.sprite.position.y - currentPos.y;
		}
	}
  
  return spears[closestID];
}



function get_State()
{
  var distance = get_closest_arrow();
  var x = distance.x;
  var y = distance.y;
  
  var stateName = "";
  
  if(x > 0)
    {
      stateName = "left";
    }
  if(x < 0)
    {
      stateName = "right";
    }
  if(y > 0)
    {
      stateName = "up";
    }
  if(y < 0)
    {
      stateName = "down";
    }
  
  return stateName;
}

function bot_press_key(key)
{
	handleKeyInput(key, 'down');
	handleKeyInput(key, 'up');
}


function bot_press_key_and_hold(key)
{
	if (bot_pressed_key != key)
	{
		handleKeyInput(bot_pressed_key, 'up');
		bot_pressed_key = key;
		if(key != "none")
			handleKeyInput(key, 'down');
	}
}


//Update Loop
window.setInterval(function () 
{
	// Ensures that bot is neurtral at the start of Spear phase
	bot_press_key_and_hold("none");
	
	// Skip through splash screen
	if (scene.scene_state == 'splash')
	{
		bot_press_key('A');
	}
  
	if(oldHP != heart.hp)
    {
		if(heart.hp < oldHP)
        {
			bot_Update_Score("hit");
			if(attack_queue[0].type == 'arrow')
            {
				arrowDmg++;
            }
             
			if(attack_queue[0].type == 'spear')
            {              
				spearDmg++;
            }            
        }
		oldHP = heart.hp;
    }
	previousState = gamestate.state;
  
	if (scene.scene_state == 'gameplay')
	{    
		if(gamestate.state == 'gameover' && !handeledDeath)
		{
			gamesPlayed++;
			if(saveToFile)
				WriteToFile(gamesPlayed, gamestate.elapsed_time, qValues, initial_Learn_Rate, bot_Discount);
			handeledDeath = true;                    
		}    
		
		// Skip through menu and gameover prompts
		if (gamestate.state == 'menu' || gamestate.state == 'gameover')
		{      
			bot_press_key('A');
		} 
		else
		{
			//Reset Deathhandle Flag
			if(handeledDeath)
			{
				handeledDeath = false;
			}
			bot_Take_Action(); 
		}  
	} 
}, updateInterval);

function bot_Take_Action()
{
	var action = "none";  
	action = bot_Get_Action();
	bot_press_key_and_hold(action);
  
	if(attack_queue[0].type == 'arrow')
    {
		var arrowCount = get_Projectile_Count();
		if(oldArrowCount != arrowCount)
		{
			oldArrowCount = arrowCount;
		}
	} 
}


// File Writing
SaveData = function(itter, time, arrowDmg, spearDmg, lr, discount)
{  
	GM_xmlhttpRequest ( 
	{
		method:     "POST",
		url:        "http://localhost/UndyneBotLog/writer.php",
		data:       "itter="+itter+"&time="+time+"&arrowDmg="+arrowDmg+"&spearDmg="+spearDmg + "&lr=" + lr + "&discount=" + discount,
		headers:    {"Content-Type": "application/x-www-form-urlencoded"}
	} );
	console.log("Saved Logging Data");
};

SaveQValues = function(QValues, lr, discount)
{  
	// + JSON.stringify ( {myData:QValues} )
	console.log("Saving Q-Values");
	GM_xmlhttpRequest ( 
	{
		method:     "POST",
		url:        "http://localhost/UndyneBotLog/writer.php",
		data:       "myData=" + JSON.stringify( {myData:qValues}) + "&lr=" + lr + "&discount=" + discount,
		headers:    {"Content-Type": "application/x-www-form-urlencoded"},
		onerror:    function(reponse) 
		{
			//alert('error');
			console.log("error: ", reponse);
		}
	} );  
	console.log("Saved Q Data");
};

function WriteToFile(itter, time, QValues, lr, discount)
{
	//Transform to seconds and floor to 2 digits after comma
    time = time/1000;
    time = time.toFixed(2);
	console.log(QValues);
	
	// It is impossible to die this soon! Avoids faulty writes.
	if(time <= 2 )
		return;
  
	//Arcane Greasemonkey semantics require this syntax
	setTimeout(function () 
	{   
		SaveQValues(QValues, lr, discount);
	}, 0);
  
	setTimeout(function () 
	{   
		SaveData(itter,time, arrowDmg, spearDmg, lr, discount);
	}, 0);  
}
