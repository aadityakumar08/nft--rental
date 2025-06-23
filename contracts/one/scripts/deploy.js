async function main() {
  const HelloWorld = await ethers.getContractFactory("VIBE")
  // Start deployment, returning a promise that resolves to a contract object
  const hello_world = await HelloWorld.deploy("0x9Bb4EfF11bb56a17eAff5d1e3dA6979F2FED001A")
  console.log("Contract deployed to address:", hello_world.target)
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
