/*
*Created by Adarsh in November 2018 for the project FoodTracker
* Objective of the Project is to track the food along the supply chain of the food
*
*The code below describes the script
*It defines the logics of the project.
*It uses the data model defined in model file
*It can also contain any private functions that is required but it cannot be called by the end user for any operation.
*Hence, these functions will be used internally for logical functioning of the public functions
*/

/**
 * A shipment has been received by an importer
 * @param {org.acme.shipping.perishable.ShipmentReceived} shipmentReceived - the ShipmentReceived transaction
 * @transaction
 */
async function payOut(shipmentReceived) {  // eslint-disable-line no-unused-vars

	//Adding code on 18/11/2018
    const NS = 'org.acme.shipping.perishable';
    const factory = getFactory();
    const contract = shipmentReceived.shipment.contract;
    const shipment = shipmentReceived.shipment;
    const grower = shipmentReceived.shipment.contract.grower;
    const importer = shipmentReceived.shipment.contract.importer;
    const shipper = shipmentReceived.shipment.contract.shipper;
    const food = shipmentReceived.food;
    
     // add the farmers
	const growerRegistry = await getParticipantRegistry(NS + '.Grower');

	// add the importers
	const importerRegistry = await getParticipantRegistry(NS + '.Importer');

	// add the shippers
	const shipperRegistry = await getParticipantRegistry(NS + '.Shipper');

	// add the contracts
	const contractRegistry = await getAssetRegistry(NS + '.Contract');

	// add the shipments
	const shipmentRegistry = await getAssetRegistry(NS + '.Shipment');
    
            //add the foods
            const foodRegistry = await getAssetRegistry(NS + '.Food');
    
    
            //const contract = shipmentReceived.shipment.contract;
	//const shipment = shipmentReceived.shipment;
	let payOut = contract.unitPrice * shipment.unitCount;
            let reputation = 0;

	console.log('Received at: ' + shipmentReceived.timestamp);
	console.log('Contract arrivalDateTime: ' + contract.arrivalDateTime);

	// set the status of the shipment
	shipment.status = 'ARRIVED';

	// if the shipment did not arrive on time the payout is zero
	if (shipmentReceived.timestamp > contract.arrivalDateTime) {
    	payOut = 0;
    	console.log('Late shipment');
   	 // reduce reputation credits on late shipment
   	 reputation -=1;
	} else {
    	// find the lowest temperature reading
    	if (shipment.temperatureReadings) {
        	// sort the temperatureReadings by centigrade
        	shipment.temperatureReadings.sort(function (a, b) {
            	return (a.centigrade - b.centigrade);
        	});
        	const lowestReading = shipment.temperatureReadings[0];
        	const highestReading = shipment.temperatureReadings[shipment.temperatureReadings.length - 1];
        	let penalty = 0;
        	console.log('Lowest temp reading: ' + lowestReading.centigrade);
        	console.log('Highest temp reading: ' + highestReading.centigrade);
   		 
   				 // does the lowest temperature violate the contract?
   				 if (lowestReading.centigrade < contract.minTemperature) {
   					 penalty += (contract.minTemperature - lowestReading.centigrade) * contract.minPenaltyFactor;
   					 console.log('Min temp penalty: ' + penalty);
   					 // reduce reputation credits on temperature deviation
   					 reputation -=1;
   				 }
   	 
   				 // does the highest temperature violate the contract?
   				 if (highestReading.centigrade > contract.maxTemperature) {
   					 penalty += (highestReading.centigrade - contract.maxTemperature) * contract.maxPenaltyFactor;
   					 console.log('Max temp penalty: ' + penalty);
   					 // reduce reputation credits on temperature deviation
   					 reputation -=1;   			 
   				 }
   			 
        	// apply any penalities
        	payOut -= (penalty * shipment.unitCount);
   		 
   		 if ((highestReading.centigrade < contract.maxTemperature) && (lowestReading.centigrade > contract.minTemperature)) {
   			 // reduce reputation credits on temperature deviation
   			 reputation +=1;   		 
        	}

    	}
	}

	console.log('Payout: ' + payOut);
            contract.shipper.accountBalance    += payOut/10;
	contract.grower.accountBalance += payOut;
	contract.importer.accountBalance -= payOut;
    
            console.log('Repuation: ' + reputation);
            contract.shipper.reputation    += reputation;
	contract.grower.reputation += reputation;
	contract.importer.reputation += reputation;

	console.log('Grower: ' + contract.grower.$identifier + ' new balance: contract.grower.accountBalance);
	console.log('Importer: ' + contract.importer.$identifier + ' new balance: ' + contract.importer.accountBalance);

	// update the grower's balance
	await growerRegistry.update(contract.grower);

	// update the importer's balance
	await importerRegistry.update(contract.importer);
    
             // update the shipper's balance and reputation
	await shipperRegistry.update(contract.shipper);

	// update the state of the shipment
	await shipmentRegistry.update(shipment);
    
    //Update Food ownership
	food.importer = factory.newRelationship(NS, 'Importer', contract.importer.$identifier);
	food.shipper = factory.newRelationship(NS, 'Shipper', contract.shipper.$identifier);
            food.owner = contract.importer.$identifier;
            await foodRegistry.update(food);
}

/**
 * A temperature reading has been received for a shipment
 * @param {org.acme.shipping.perishable.TemperatureReading} temperatureReading - the TemperatureReading transaction
 * @transaction
 */
async function temperatureReading(temperatureReading) {

	const shipment = temperatureReading.shipment;

	console.log('Adding temperature ' + temperatureReading.centigrade + ' to shipment ' + shipment.$identifier);

	if (shipment.temperatureReadings) {
    	shipment.temperatureReadings.push(temperatureReading);
	} else {
    	shipment.temperatureReadings = [temperatureReading];
	}

	// add the temp reading to the shipment
            const shipmentRegistry = await getAssetRegistry('org.acme.shipping.perishable.Shipment');
	await shipmentRegistry.update(shipment);
}

/**
 * Initialize some test assets and participants useful for running a demo.
 * @param {org.acme.shipping.perishable.SetupDemo} setupDemo - the SetupDemo transaction
 * @transaction
 */
async function setupDemo(setupDemo) {

	const factory = getFactory();
	const NS = 'org.acme.shipping.perishable';

	// create the grower
	const grower = factory.newResource(NS, 'Grower', 'farmer@email.com');
	const growerAddress = factory.newConcept(NS, 'Address');
	growerAddress.country = 'USA';
	grower.address = growerAddress;
	grower.accountBalance = 0;

	// create the importer
	const importer = factory.newResource(NS, 'Importer', 'supermarket@email.com');
	const importerAddress = factory.newConcept(NS, 'Address');
	importerAddress.country = 'UK';
	importer.address = importerAddress;
	importer.accountBalance = 0;

	// create the shipper
	const shipper = factory.newResource(NS, 'Shipper', 'shipper@email.com');
	const shipperAddress = factory.newConcept(NS, 'Address');
	shipperAddress.country = 'Panama';
	shipper.address = shipperAddress;
	shipper.accountBalance = 0;
    
    /*
    // create the customers
	const customer = factory.newResource(NS, 'Customer', 'customer@email.com');
	const customerAddress = factory.newConcept(NS, 'Address');
	customerAddress.country = 'India';
	customer.address = customerAddress;
	customer.accountBalance = 0;
    */--commented

	// create the contract
	const contract = factory.newResource(NS, 'Contract', 'CON_001');
	contract.grower = factory.newRelationship(NS, 'Grower', 'farmer@email.com');
	contract.importer = factory.newRelationship(NS, 'Importer','supermarket@email.com');
	contract.shipper = factory.newRelationship(NS, 'Shipper', 'shipper@email.com');
            //contract.customer = factory.newRelationship(NS, 'Customer', 'customer@email.com');
    
	const tomorrow = setupDemo.timestamp;
	tomorrow.setDate(tomorrow.getDate() + 1);
	contract.arrivalDateTime = tomorrow; // the shipment has to arrive tomorrow
	contract.unitPrice = 0.5; // pay 50 cents per unit
	contract.minTemperature = 2; // min temperature for the cargo
	contract.maxTemperature = 10; // max temperature for the cargo
	contract.minPenaltyFactor = 0.2; // we reduce the price by 20 cents for every degree below the min temp
	contract.maxPenaltyFactor = 0.1; // we reduce the price by 10 cents for every degree above the max temp

	// create the shipment
	const shipment = factory.newResource(NS, 'Shipment', 'SHIP_001');
	shipment.type = 'BANANAS';
	shipment.status = 'IN_TRANSIT';
	shipment.unitCount = 5000;
	shipment.contract = factory.newRelationship(NS, 'Contract', 'CON_001');

	// add the growers
	const growerRegistry = await getParticipantRegistry(NS + '.Grower');
	await growerRegistry.addAll([grower]);

	// add the importers
	const importerRegistry = await getParticipantRegistry(NS + '.Importer');
	await importerRegistry.addAll([importer]);

	// add the shippers
	const shipperRegistry = await getParticipantRegistry(NS + '.Shipper');
	await shipperRegistry.addAll([shipper]);

	// add the contracts
	const contractRegistry = await getAssetRegistry(NS + '.Contract');
	await contractRegistry.addAll([contract]);

	// add the shipments
	const shipmentRegistry = await getAssetRegistry(NS + '.Shipment');
	await shipmentRegistry.addAll([shipment]);
    
            // add the customer --commented
	//const customerRegistry = await getAssetRegistry(NS + '.Customer');
	//await customerRegistry.addAll([customer]);
}
