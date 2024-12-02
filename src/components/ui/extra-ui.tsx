import React, { useState } from "react";

export const NavbarFilters = () => {

    return (
        <>
            <div className="text-xs font-medium text-gray-500">
                <p>Filters: </p>
                <span className={`transform transition-transform`}>
                    ▼
                </span>
            </div>


            <p className="text-sm font-medium text-gray-700">Creation Time</p>
            <div className="flex space-x-4">
                <input
                    type="number"
                    className="w-1/2 border-2 border-gray-300 p-1 text-xs focus:outline-none focus:border-black"
                    placeholder="Min"
                />
                <input
                    type="number"
                    className="w-1/2 border-2 border-gray-300 p-1 text-xs focus:outline-none focus:border-black"
                    placeholder="Max"
                />
            </div>
            <p className="text-sm font-medium text-gray-700">Volume</p>
            <div className="flex space-x-4">
                <input
                    type="number"
                    className="w-1/2 border-2 border-gray-300 p-1 text-xs focus:outline-none focus:border-black"
                    placeholder="Min"
                />
                <input
                    type="number"
                    className="w-1/2 border-2 border-gray-300 p-1 text-xs focus:outline-none focus:border-black"
                    placeholder="Max"
                />
            </div>
            <p className="text-sm font-medium text-gray-700">Featured</p>
            <div className="flex space-x-4">
                <input
                    type="number"
                    className="w-1/2 border-2 border-gray-300 p-1 text-xs focus:outline-none focus:border-black"
                    placeholder="Min"
                />
                <input
                    type="number"
                    className="w-1/2 border-2 border-gray-300 p-1 text-xs focus:outline-none focus:border-black"
                    placeholder="Max"
                />
            </div>

            <div className="flex w-full py-4">
                <button className="w-1/2 p-2 border-2 border-black text-sm font-medium text-black hover:bg-gray-200">
                    Apply
                </button>
                <button className="w-1/2 p-2 border-2 border-grey-500 text-sm font-medium text-black hover:bg-gray-200">
                    Reset
                </button>
            </div>

            <p className="text-sm font-medium text-gray-700">Bonded Time</p>
            <div className="flex space-x-4">
                <input
                    type="number"
                    className="w-1/2 border-2 border-gray-300 p-1 text-xs focus:outline-none focus:border-black"
                    placeholder="Min"
                />
                <input
                    type="number"
                    className="w-1/2 border-2 border-gray-300 p-1 text-xs focus:outline-none focus:border-black"
                    placeholder="Max"
                />
            </div>
            <p className="text-sm font-medium text-gray-700">Locked Amount / progress</p>
            <div className="flex space-x-4">
                <input
                    type="number"
                    className="w-1/2 border-2 border-gray-300 p-1 text-xs focus:outline-none focus:border-black"
                    placeholder="Min"
                />
                <input
                    type="number"
                    className="w-1/2 border-2 border-gray-300 p-1 text-xs focus:outline-none focus:border-black"
                    placeholder="Max"
                />
            </div>
            <p className="text-sm font-medium text-gray-700">Market cap</p>
            <div className="flex space-x-4">
                <input
                    type="number"
                    className="w-1/2 border-2 border-gray-300 p-1 text-xs focus:outline-none focus:border-black"
                    placeholder="Min"
                />
                <input
                    type="number"
                    className="w-1/2 border-2 border-gray-300 p-1 text-xs focus:outline-none focus:border-black"
                    placeholder="Max"
                />
            </div>
        </>
    );
};

export function NavbarCard({ name }: { name: string }) {

    return (

        <div className="w-full mx-auto mt-4 cursor-pointer">
            <div className="relative border-2 border-black bg-white p-3">
                <div className="flex items-start mb-2">
                    <img
                        src="https://via.placeholder.com/80"
                        alt="Icon"
                        className="w-5 h-5 border border-black"
                    />
                    <div className="ml-4">
                        <h2 className="text-md font-bold">
                            <span className="font-bold">{name}</span>
                            <span className="font-normal"> | goose</span>
                        </h2>
                    </div>
                </div>
                <div className="mt-3 h-2 border-2 border-black bg-white relative">
                    <div
                        className="absolute top-0 left-0 h-full bg-black"
                        style={{ width: "66%" }}
                    ></div>
                </div>


            </div>
        </div>
    )
}
