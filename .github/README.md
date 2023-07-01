# `MyORM` json-adapter

Database adapter for [MyORM](https://github.com/myorm/myorm) that works on database-like structured JavaScript objects (or JSON).

## Overview

The JSON adapter is meant for working on JavaScript objects and is strictly meant to be used as a learning tool. More accurately, you would find usage of this adapter on https://myorm.dev/playground, where all usage of [MyORM](https://www.github.com/myorm/myorm) will be connected with this adapter to a local storage database, so every user can individually see how the library works without directly working with some database.

## Structure

The JSON adapter, unlike other official database adapters like the [MySQL adapter](https://www.github.com/myorm/mysql-adapter), takes in a JavaScript object that specifies the schema and data being worked with. The exact structure of this object will look something like this:

```js
const jsonAdapterStructure = {
    $schema: {
        Car: {
            Id: {
                table: "Car",
                field: "Id",
                alias: "",
                isPrimary: true,
                isIdentity: true,
                isVirtual: false,
                defaultValue: () => undefined
            },
            Make: {
                table: "Car",
                field: "Make",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                defaultValue: () => undefined
            },
            Model: {
                table: "Car",
                field: "Model",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                defaultValue: () => undefined
            },
            Color: {
                table: "Car",
                field: "Color",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                defaultValue: () => undefined
            },
            Year: {
                table: "Car",
                field: "Year",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                defaultValue: () => undefined
            },
            Mileage: {
                table: "Car",
                field: "Mileage",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                defaultValue: () => undefined
            },
            MPGHwy: {
                table: "Car",
                field: "MPGHwy",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                defaultValue: () => undefined
            },
            MPGCity: {
                table: "Car",
                field: "MPGCity",
                alias: "",
                isPrimary: false,
                isIdentity: false,
                isVirtual: false,
                defaultValue: () => undefined
            },
        }
    },
    $database: {
        Car: [
            { Id: 1, Make: "Ford", Model: "Focus", Color: "Yellow", Year: 2020, Mileage: 32145, MPGHwy: 37.6, MPGCity: 26.2 },
            { Id: 2, Make: "Toyota", Model: "Tundra", Color: "Red", Year: 2014, Mileage: 121419, MPGHwy: 32.9, MPGCity: 21.7 },
            { Id: 3, Make: "Ford", Model: "Fusion", Color: "Red", Year: 2019, Mileage: 69225, MPGHwy: 34.3, MPGCity: 26.9 },
            { Id: 4, Make: "Chevy", Model: "Equinox", Color: "Red", Year: 2022, Mileage: 17143, MPGHwy: 35.1, MPGCity: 22.4 },
            { Id: 5, Make: "Ford", Model: "Escape", Color: "Blue", Year: 2022, Mileage: 13417, MPGHwy: 34.9, MPGCity: 20.6 },
            { Id: 6, Make: "Toyota", Model: "Tacoma", Color: "Blue", Year: 2023, Mileage: 499, MPGHwy: 29.7, MPGCity: 16.4 },
            { Id: 7, Make: "Ford", Model: "F150", Color: "Blue", Year: 2020, Mileage: 51222, MPGHwy: 28.6, MPGCity: 17.0 },
            { Id: 8, Make: "Chevy", Model: "Malibu", Color: "White", Year: 2018, Mileage: 67446, MPGHwy: 37.2, MPGCity: 23.7 },
            { Id: 9, Make: "Toyota", Model: "Tacoma", Color: "White", Year: 2023, Mileage: 2747, MPGHwy: 30.1, MPGCity: 16.8 },
            { Id: 10, Make: "Dodge", Model: "Charger", Color: "White", Year: 2022, Mileage: 7698, MPGHwy: 29.9, MPGCity: 14.1 },
            { Id: 11, Make: "Toyota", Model: "RAV4", Color: "Black", Year: 2021, Mileage: 21567, MPGHwy: 28.2, MPGCity: 13.8 },
            { Id: 12, Make: "Toyota", Model: "RAV4", Color: "Black", Year: 2013, Mileage: 123411, MPGHwy: 28.1, MPGCity: 14.1 },
            { Id: 13, Make: "Dodge", Model: "Hornet", Color: "Black", Year: 2013, Mileage: 108753, MPGHwy: 31.5, MPGCity: 16.9 },
            { Id: 14, Make: "Chevy", Model: "Malibu", Color: "Silver", Year: 2021, Mileage: 14353, MPGHwy: 34.9, MPGCity: 20.0 },
            { Id: 15, Make: "Dodge", Model: "Charger", Color: "Silver", Year: 2020, Mileage: 92442, MPGHwy: 26.6, MPGCity: 13.1 },
        ]
    }
};
```

So long as the consumer of this library knows the schema they work with, and each object to the respective schema appears as so, the consumer can create a mock database that works strictly off of in-memory JavaScript objects instead of real database rows.  

## Usage

The JSON-adapter is not intended to be used in a production setting that involves real data, and in most cases this can be dangerous, especially if using data that is user-sensitive like passwords or anything else. <span style="color:red;font-weight:bold;">With this in mind, it is IMPERATIVE you do not use this adapter with real data, unless the data being worked on is insensitive, as there are no promises this secure.</span>

### Development

As mentioned previously, this adapter acts as a learning tool, but can also be used as a substitution for a real database during development.  

For example, say you are making a Web Application for a used car dealership, but you are unsure of the final schema you may want for your real database. You can use the `json-adapter` to create a mock database in-code (or from user storage like local or session storage) to begin development. All commands that you would normally use in `MyORM` for a regular database will be the exact same as what you use, the only difference is the source of data you are grabbing from.  

Take this SvelteKit example with the previous section's mock database example:

/lib/server/database.ts
```ts
import type { Car } from './types.ts';
import { adapter } from '@myorm/json-adapter';
import { MyORMContext } from "@myorm/myorm";

const database = {
  $schema: {} // ... same as $schema from previous section's example
  $database: localStorage.get('cars')
};
export const usedCars: MyORMContext<Car> = new MyORMContext(adapter(database), "Car");
```

/cars/+page.server.ts
```ts
import { usedCars } from "$lib/server/database.ts";

export async function load() {
  const allUsedCars = await usedCars.select();
  return { cars: allUsedCars };
}
```

/cars/+page.svelte
```html
<script>
import { toasts } from "$lib/stores/toasts.js";
export let data;

// new car modal open prop
let open = false;

async function addNewCar({ detail }) {
  const { car } = detail;
  const res = await fetch('/cars', {
    method: 'POST',
    body: JSON.stringify(car);
  });
  if(!res.ok) toasts.bad('Something went wrong!');
  else toasts.good(`Successfully added ${car.Make} ${car.Model} ${car.Year}`);
}
</script>

<NewCarModal bind:open on:submit={addNewCar}/>

<table>
  <thead>
    <tr>
      <td>Id</td>
      <td>Make</td>
      <td>Model</td>
      <td>Color</td>
      <td>Year</td>
      <td>Mileage</td>
      <td>MPGHwy</td>
      <td>MPGCity</td>
    </tr>
  </thead>
  <tbody>
  </tbody>
    {#each data.cars as car,n(car.Id)}
      <tr>
        <td>{car.Id}</td>
        <td>{car.Make}</td>
        <td>{car.Model}</td>
        <td>{car.Color}</td>
        <td>{car.Year}</td>
        <td>{car.Mileage}</td>
        <td>{car.MPGHwy}</td>
        <td>{car.MPGCity}</td>
      </tr>
    {/each}
  <tfoot>
    <tr>
      <td colspan={100}>
        <button on:click={() => open = true}>Add new car</button>
      </td>
    </tr>
  </tfoot>
</table>
```

/cars/+page.server.ts
```ts
export async function POST({ request }) {
  import type { Car } from "$lib/types.ts";
  import { usedCars } from "$lib/server/database.js";
  import { error } from "@sveltejs/kit";
  
  const json: Car = await request.json();
  try {
    const car = await usedCars.insert(json);
  } catch(err) {
    throw error(500, 'Something went wrong!');
  }
  return car;
}
```

With this setup, now you can work with a database that strictly only in local storage of the user's browser, and if you feel comfortable with the database and schema you have set up, all you would have to change is `/lib/server/database.js` to be connected to the actual database using some other real database `MyORM` adapter.

### Learning

As mentioned previously, this can be used appropriately for educational tools, like the [MyORM Playground](https://myorm.dev/playground). In these cases, it would be best to hook up a mock database into local storage. In all other cases, follow the appropriate expectations of the database being used at hand.

### Other

#### eCommerce

Other cases that this may be useful is for `eCommerce` shopping carts, where you can store one or more shopping carts for a user in session/local storage.

#### Redis

Although, this is not the intention of this adapter, and would likely be its own adapter eventually, the json-adapter could be used for `Redis` IO, making it easier to interact with your Redis storage. Keep in mind, this may have security implications, as testing is not complete, so use in this context at your own risk.

#### MongoDB

Although, this is not the intention of this adapter, and would likely be its own adapter eventually, the json-adapter could be used for `MongoDB` transactions, making it easier to interact with MongoDB documents. Keep in mind, this may have security implications, as testing is not complete, so use in this context at your own risk.

## Notes

Keep in mind, since the JSON adapter works entirely apart from a real database, event handling can emit different arguments than expected. For example, the command that you would receive for any event would be "No command available." and the arguments would likely be some random data that is actually used in the respective command from adapter tools `.execute()`. The arguments is like this because there is no command nor are there arguments. Since `MyORM` does not internally do anything with the serialized command data, other than pass it back to the `.execute()` portion of the adapter, the actual data is passed this way with some type ignoring to achieve the goal of the json-adapter.

Additionally, as the json-adapter is still in development, certain features are still being worked on. Specifically, this would be relationships (`.hasOne()`, `.hasMany()`, `.include()` and their respective chains) and grouping (`.groupBy()`).
