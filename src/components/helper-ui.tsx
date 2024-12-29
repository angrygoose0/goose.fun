import React, { FC } from "react";

// Define the type for the props
interface InputViewProps {
    name: string; // Name of the input field
    placeholder: string; // Placeholder text for the input
    value?: string; // Optional value of the input field
    clickhandle?: (e: React.ChangeEvent<HTMLInputElement>) => void; // Optional function to handle changes
    className?: string; // Optional class name for styling
}

// Use the props type with the FC generic
export const InputView: FC<InputViewProps> = ({ name, placeholder, value, clickhandle }) => {
    // Fallback to a no-op function if clickhandle is not provided
    const handleChange = clickhandle || (() => { });

    return (
        <div className="mb-4">
            <label htmlFor={`input-${name.toLowerCase()}`} className="block mb-2 font-medium">
                {name}
            </label>
            <input
                type="text"
                id={`input-${name.toLowerCase()}`}
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                className="w-full border-2 border-gray-200 p-2 text-sm focus:outline-none focus:border-black"
            />
        </div>
    );
};
